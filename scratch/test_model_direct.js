const apiKey = process.env.GEMINI_API_KEY;

async function testModel(modelName) {
  console.log(`\nTesting model: ${modelName}...`);
  const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hello! Say short test response." }] }]
      })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`SUCCESS: ${modelName} works!`);
      console.log(JSON.stringify(data.candidates?.[0]?.content?.parts?.[0]?.text || data, null, 2));
    } else {
      console.log(`ERROR ${res.status}:`, data.error?.message || data);
    }
  } catch (err) {
    console.error(`Fetch error for ${modelName}:`, err);
  }
}

async function run() {
  await testModel("gemini-2.0-flash");
  await testModel("gemini-3.1-flash-lite");
  await testModel("gemini-1.5-flash");
}

run();
