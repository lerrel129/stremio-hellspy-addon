import { addonBuilder, serveHTTP } from "stremio-addon-sdk";
import axios from "axios";

const builder = new addonBuilder({
    id: 'Hellspy',
    version: '1.0.0',
    name: 'Hellspy.to',
    description: "Hellspy video streaming",
    logo: "https://www.hellspy.to/img/logo.png",
    resources: ['catalog', 'stream', 'meta'],
    types: ['movie', 'series'],
    catalogs: [
        {
            type: "movie",
            id: "hellspy",
            name: "Hellspy videos",
            extra: [
                //{ name: "search", isRequired: false }  // ← toto je dôležité
                { name: "search"}  // ← toto je dôležité
            ]
        }
    ],
    idPrefixes: ['tt', "hellspy"]
}
)

// takes function(args)
builder.defineStreamHandler(async function(args) {
    //console.log("!!!!!defineStreamHandler: ", args)
    let streams = []
    if(args.id.startsWith("tt"))
    {
        id = args.id.split(":")[0]
        url = `https://api.themoviedb.org/3/find/${id}?api_key=a07324c669cac4d96789197134ce272b&external_source=imdb_id&language=sk-SK,cs-CS&append_to_response=credits,images,release_dates,videos`
        response = await axios.get(url)
        query = response.data?.movie_results[0] ? `${response.data.movie_results[0].original_title} ${response.data.movie_results[0].release_date.substring(0, 4)}` : `${response.data.tv_results[0].original_name} s${args.id.split(":")[1]}e${args.id.split(":")[2]}` 
        //query = response.data?.movie_results[0] ? `${response.data.movie_results[0].title} ${response.data.movie_results[0].release_date.substring(0, 4)}` : `${response.data.tv_results[0].original_name} s${args.id.split(":")[1]}e${args.id.split(":")[2]}` 
        files = await search(query, false)
        streams = files.map(file => ({
            name:  `${file.resolution ? `📺${file.resolution.match(/x(\d+)/i)[1]}p  ` : "" }${file.size ? `💾${file.size}   ` : ""}`, //|| file.name,               // napr. 1080p, fallback na názov
            url: file.d_link,                                 // link na prehratie
            description: `${file.name.replaceAll(/ /g, "\u00A0").replace(/\s+(?=\S*$)/, ".")}\n${file.duration ? "⏱" + file.duration : ""}\n${file.audio?.audio_stopy ? "🔊" + file.audio.audio_stopy.split(/\s+/).join("|").replaceAll(",","")  : ""}\n${file.video?.titulky ? "💬" + file.video.titulky.split(/\s+/).join("|").replaceAll(",","") : "" }`,
            thumbnail: file.thumbnail,
            //type: "movie"
            }))       
        
    }
    else //prehranie streamu z vyhladavania jednotlivych suborov z katalogu
    {
        console.log("args", args)
        streams = [
        {
            //name: "_______"+args.id.split(";")[1],
            url: args.id.split(";")[0].replace("hellspy:", ""),
            // description: "test",
        }]
    }
    //console.log("streams:", streams)
    return { streams }
})

builder.defineCatalogHandler(async function(args) {
    let files = await search(args.extra.search)
    //console.log("files", files) 

    //console.log("POSTER", files[0].thumbnail) 
    const metas = files.map(f => ({
        id: `hellspy:${f.d_link};${f.name};${f.thumbnail};${f.audio?.audio_stopy? `🔊`+f.audio.audio_stopy.replaceAll(",", "|"): ""};${f.video?.titulky? `💬`+f.video.titulky.replaceAll(",", "|"): ""}`,
        name: f.name,
        poster: (!f.thumbnail || f.thumbnail.toLowerCase().includes("/images/icons")) ? ("https://fastshare.cloud/" + f.thumbnail) : f.thumbnail,
        //"posterShape": "regular",
        description: f.name || "",
        type: "movie"
    }))

        // const metas = {
        // id: `hellspy:TESTTTT`,
        // name: "TESTTTT2222",
        // poster: "POSTERRR",
        // //"posterShape": "regular",
        // description: "test description",
        // type: "movie"
    //}
    //console.log("METAS:", metas)
    return { "metas": metas }
})

builder.defineMetaHandler(function(args) {
    // console.log("defineMetaHandler_args:", args)
    // console.log("defineMetaHandler_args:", args.id)

    const metaObj = {
        id: args.id,
        name: args.id.split(";")[1],
        description: `${args.id.split(";")[3]}\n${args.id.split(";")[4]}`,
        //releaseInfo: '2010',
        background: args.id.split(";")[2],
        poster: args.id.split(";")[2],
        posterShape: 'poster',
        //type: 'movie'
    }
    return Promise.resolve({ meta: metaObj })
})

async function search(query, video_details = false)
{
    console.log("query: ", query)
    url = `https://api.hellspy.to/gw/search?query=${query.replaceAll(" ", "%20")}&offset=0&limit=99`
	
    const response = await axios.get(url, {
		  headers: {
		    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
		    "Accept": "application/json, text/plain, */*",
		    "Referer": "https://www.hellspy.to/"
		  }
		});
	if (response.status == 200)
	{
		videos = response.data.items
	}
	else
		console.log(responseerror , response.status)

    const start = Date.now()
    let files = []
    if (videos.length != 0) {
        for (const video of videos) {
            let audio = []
            audio.audio_stopy = ""
            video_title_lower = video.title.toLowerCase()
            if (video_title_lower.includes("sk") && !video_title_lower.includes("česk") && !video_title_lower.includes("cesk")) 
                audio.audio_stopy = "SK"
		    if (video_title_lower.includes("cz") || video_title_lower.includes("cs") || video_title_lower.includes("český") || video_title_lower.includes("cesky")) 
                audio.audio_stopy = audio.audio_stopy? audio.audio_stopy + " CZ" : "CZ"

            objectType = video.objectType.toLowerCase()
            let file = {
                name: video.title,
                size: `${(video.size / (1024 ** 3)).toFixed(2)} GB`,
                duration: `${Math.floor(video.duration / 3600)}h ${Math.floor((video.duration % 3600) / 60)}m`,
                //resolution: resolution,
                thumbnail: video.thumbs[0],
                d_link: `https://api.hellspy.to/${objectType.substring(0, 2)}/${objectType.slice(-5)}/${video.id}/${video.fileHash}/download`,
                audio: audio
            }
            files.push(file)
        }
    }

    return files
}

const port = process.env.PORT || 3000;
serveHTTP(builder.getInterface(), { port });

//export default (req, res) => {
//    return serveHTTP(builder.getInterface())(req, res);
//console.log("Hellspy addon running on port " + port);
console.log("test rqeuest");

url = `https://api.hellspy.to/gw/search?query=problem child 2&offset=0&limit=99`
const response = await axios.get(url, {
	  headers: {
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
		"Accept": "application/json, text/plain, */*",
		"Referer": "https://www.hellspy.to/"
	  }
	});
if (response.status == 200)
{
	videos = response.data.items
	console.log("test rqeuest OK")
}
else
	console.log(responseerror , response.status)
	console.log("test rqeuest false")

























