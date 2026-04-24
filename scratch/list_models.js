const GEMINI_API_KEY = "AIzaSyBg41GVTQ-S2jumeUQlHIImCv2qkrruY-8";
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    console.log("Available Models:");
    if (data.models) {
        data.models.forEach(m => console.log(m.name));
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
  })
  .catch(err => console.error(err));
