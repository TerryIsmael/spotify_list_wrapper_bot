import { Router } from "express";

const router = Router();
const token = process.env.SPOTIFY_TOKEN;
const intervals = {};

router.get("/login", (req, res) => {
    const scopes = encodeURIComponent("playlist-modify-public playlist-modify-private");
    const redirect_uri = encodeURIComponent(process.env.BASE_URL+"/callback");
    const auth_url = `https://accounts.spotify.com/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${redirect_uri}&scope=${scopes}`;
  
    res.redirect(auth_url);
});

router.get("/callback", async (req, res) => {
    const code = req.query.code;
  
    const token_response = await fetch("https://accounts.spotify.com/api/token", {
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
  
    const token_data = await token_response.json();
  
    if (token_data.access_token) {
        const access_token = token_data.access_token;
        res.cookie("access_token", access_token, { httpOnly: true, secure: true });
        res.json({ message:"You're logged successfully"}); 
    } else {
        res.status(400).json({ error: "An error occurred. Try again" });
    }
  });

router.post('/lists/', async (req, res, next) => {
    try{
        if(!req.cookies.access_token){
            res.status(401).json({ error: "You need to be logged in" });
            return;
        }
        if(!req.body.list_ids || !req.body.list_name){
            res.status(400).json({ error: "You need to provide list_name and list_ids (splitted by commas)" });
            return;
        }
        const access_token = req.cookies.access_token;
        const list_name = req.body.list_name;
        const list_ids = req.body.list_ids.split(',');
        let uris= []

        for (const list_id of list_ids){
            let iterate=true;
            let offset = 0;
            while (iterate){
                const res = await fetch(`https://api.spotify.com/v1/playlists/${list_id}/tracks?fields=items%28track%28uri%29%29&offset=${offset}&limit=100`, {
                    headers: {
                    Authorization: `Bearer ${access_token}`,
                    },
                    method: 'GET'
                });
                const data = await res.json();
                uris.push(...data.items.map(item=>item.track).filter(item=>item!==null).map(track=>track.uri));
                iterate = data.items.length === 100;
                offset += 100;
            }
        }

        const me_res = await fetch(`https://api.spotify.com/v1/me`, {
            headers: {
            Authorization: `Bearer ${access_token}`,
            },
            method: 'GET'
        });
        const user_id = (await me_res.json()).id;
        


        const create_playlist_res = await fetch(`https://api.spotify.com/v1/users/${user_id}/playlists`, {
            headers: {
            Authorization: `Bearer ${access_token}`,
            },
            method: 'POST',
            body: JSON.stringify({
                name: list_name
            })
        });
        const new_list_id = (await create_playlist_res.json()).id

        while(uris.length > 0){
            const sub_uris = uris.splice(0,100);
            await fetch(`https://api.spotify.com/v1/playlists/${new_list_id}/tracks`, {
                headers: {
                Authorization: `Bearer ${access_token}`,
                },
                method: 'POST',
                body: JSON.stringify({
                    uris: sub_uris
                })
            });
        }

        intervals[new_list_id] = setInterval(async () => {
            await updateList(access_token, new_list_id, list_ids);
        }, 60000);

        res.status(200).json(uris);
    } catch (error) {
        res.status(500).json({ error: "Internal error" });
    }
});

router.put('/lists/', async (req, res, next) => {
    try{
        if(!req.cookies.access_token){
            res.status(401).json({ error: "You need to be logged in" });
            return;
        }
        if(!req.body.list_id || !req.body.sublists_ids){
            res.status(400).json({ error: "You need to provide list_id and sublists_ids (splitted by commas)" });
            return;
        }

        const access_token = req.cookies.access_token;
        const list_id = req.body.list_id;
        const sublists_ids = req.body.sublists_ids.split(',');
        
        await updateList(access_token, list_id, sublists_ids);

        if(intervals[list_id]){
            clearInterval(intervals[list_id]);
            delete intervals[list_id];
        }

        intervals[list_id] = setInterval(async () => {
            await updateList(access_token, list_id, sublists_ids);
        }, 60000);

        res.status(200).json("Updated successfully");
    }catch (error) {
        res.status(500).json({ error: "Internal error" });
    }
});

async function updateList(access_token, list_id, sublists_ids){
    const list_uris = []
        const sublists_uris = []

        let iterate=true;
        let offset = 0;
        while (iterate){
            const res = await fetch(`https://api.spotify.com/v1/playlists/${list_id}/tracks?fields=items%28track%28uri%29%29&offset=${offset}&limit=100`, {
                headers: {
                Authorization: `Bearer ${access_token}`,
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
                    Authorization: `Bearer ${access_token}`,
                    },
                    method: 'GET'
                });
                const data = await res.json();
                sublists_uris.push(...data.items.map(item=>item.track).filter(item=>item!==null).map(track=>track.uri));
                iterate = data.items.length === 100;
                offset += 100;
            }
        }


        const to_add = sublists_uris.filter(uri=> !list_uris.includes(uri));
        const to_delete = list_uris.filter(uri=> !sublists_uris.includes(uri));

        while(to_add.length > 0){

            const sub_uris = to_add.splice(0,100);
            const addSongsRes = await fetch(`https://api.spotify.com/v1/playlists/${list_id}/tracks`, {
                headers: {
                Authorization: `Bearer ${access_token}`,
                },
                method: 'POST',
                body: JSON.stringify({
                    uris: sub_uris
                })
            });
        }
        while(to_delete.length > 0){
            const sub_uris = to_delete.splice(0,100);
            const tracks = sub_uris.map(uri=>{
                return {uri:uri};
            })

            await fetch(`https://api.spotify.com/v1/playlists/${list_id}/tracks`, {
                headers: {
                Authorization: `Bearer ${access_token}`,
                },
                method: 'DELETE',
                body: JSON.stringify({
                    tracks: tracks
                })
            });
        }
}

export default router;