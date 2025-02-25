import { Router } from "express";

const router = Router();
const token = process.env.SPOTIFY_TOKEN;
const intervals = {};

router.get("/login", (req, res) => {
    const scopes = encodeURIComponent("playlist-modify-public playlist-modify-private");
    const redirectUri = encodeURIComponent(process.env.BASE_URL+"/callback");
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}`;
  
    res.redirect(authUrl);
});

router.get("/callback", async (req, res) => {
    const code = req.query.code;
  
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.BASE_URL+"/callback",
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
      }),
    });
  
    const tokenData = await tokenResponse.json();
  
    if (tokenData.access_token) {
        const accessToken = tokenData.access_token;
        res.cookie("access_token", accessToken, { httpOnly: true, secure: true });
        res.json({ message:"You're logged successfully"}); 
    } else {
        if (process.env.TEST_MODE==="true"){
            res.status(400).json({ error: "An error occurred. Try again", json: tokenData });
        }else{
        res.status(400).json({ error: "An error occurred. Try again" });
        }
    }
  });

router.post('/lists/', async (req, res, next) => {
    try{
        const accessToken = req.cookies.access_token;
        const listname = req.body.listname;
        const list_ids = req.body.list_ids.split(',');
        let uris= []

        for (const list_id of list_ids){
            let iterate=true;
            let offset = 0;
            while (iterate){
                const res = await fetch(`https://api.spotify.com/v1/playlists/${list_id}/tracks?fields=items%28track%28uri%29%29&offset=${offset}&limit=100`, {
                    headers: {
                    Authorization: `Bearer ${accessToken}`,
                    },
                    method: 'GET'
                });
                const data = await res.json();
                uris.push(...data.items.map(item=>item.track).filter(item=>item!==null).map(track=>track.uri));
                iterate = data.items.length === 100;
                offset += 100;
            }
        }

        const meRes = await fetch(`https://api.spotify.com/v1/me`, {
            headers: {
            Authorization: `Bearer ${accessToken}`,
            },
            method: 'GET'
        });
        const userId = (await meRes.json()).id;
        


        const createPlaylistRes = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
            headers: {
            Authorization: `Bearer ${accessToken}`,
            },
            method: 'POST',
            body: JSON.stringify({
                name: listname
            })
        });
        const newListId = (await createPlaylistRes.json()).id

        while(uris.length > 0){
            const subUris = uris.splice(0,100);
            const addSongsRes = await fetch(`https://api.spotify.com/v1/playlists/${newListId}/tracks`, {
                headers: {
                Authorization: `Bearer ${accessToken}`,
                },
                method: 'POST',
                body: JSON.stringify({
                    uris: subUris
                })
            });
        }

        intervals[newListId] = setInterval(async () => {
            await updateList(accessToken, newListId, list_ids);
        }, 60000);

        res.status(200).json(uris);
    } catch (error) {
        res.status(500).json({ error: error });
    }
});

router.put('/lists/', async (req, res, next) => {
    try{
        const accessToken = req.cookies.access_token;
        const list_id = req.body.list_id;
        const sublists_ids = req.body.sublists_ids.split(',');
        
        await updateList(accessToken, list_id, sublists_ids);

        if(intervals[list_id]){
            clearInterval(intervals[list_id]);
            delete intervals[list_id];
        }

        intervals[list_id] = setInterval(async () => {
            await updateList(accessToken, list_id, sublists_ids);
        }, 60000);

        res.status(200).json("Updated successfully");
    }catch (error) {
        res.status(500).json({ error: error });
    }
});

async function updateList(accessToken, list_id, sublists_ids){
    const list_uris = []
        const sublists_uris = []

        let iterate=true;
        let offset = 0;
        while (iterate){
            const res = await fetch(`https://api.spotify.com/v1/playlists/${list_id}/tracks?fields=items%28track%28uri%29%29&offset=${offset}&limit=100`, {
                headers: {
                Authorization: `Bearer ${accessToken}`,
                },
                method: 'GET'
            });
            const data = await res.json();
            list_uris.push(...data.items.map(item=>item.track).filter(item=>item!==null).map(track=>track.uri));
            iterate = data.items.length === 100;
            offset += 100;
        } 

        for (const sublist_id of sublists_ids){
            let iterate=true;
            let offset = 0;
            while (iterate){
                const res = await fetch(`https://api.spotify.com/v1/playlists/${sublist_id}/tracks?fields=items%28track%28uri%29%29&offset=${offset}&limit=100`, {
                    headers: {
                    Authorization: `Bearer ${accessToken}`,
                    },
                    method: 'GET'
                });
                const data = await res.json();
                sublists_uris.push(...data.items.map(item=>item.track).filter(item=>item!==null).map(track=>track.uri));
                iterate = data.items.length === 100;
                offset += 100;
            }
        }


        const toAdd = sublists_uris.filter(uri=> !list_uris.includes(uri));
        const toDelete = list_uris.filter(uri=> !sublists_uris.includes(uri));

        while(toAdd.length > 0){

            const subUris = toAdd.splice(0,100);
            const addSongsRes = await fetch(`https://api.spotify.com/v1/playlists/${list_id}/tracks`, {
                headers: {
                Authorization: `Bearer ${accessToken}`,
                },
                method: 'POST',
                body: JSON.stringify({
                    uris: subUris
                })
            });
        }
        while(toDelete.length > 0){
            const subUris = toDelete.splice(0,100);
            const tracks = subUris.map(uri=>{
                return {uri:uri};
            })

            const addSongsRes = await fetch(`https://api.spotify.com/v1/playlists/${list_id}/tracks`, {
                headers: {
                Authorization: `Bearer ${accessToken}`,
                },
                method: 'DELETE',
                body: JSON.stringify({
                    tracks: tracks
                })
            });
        }
}

export default router;