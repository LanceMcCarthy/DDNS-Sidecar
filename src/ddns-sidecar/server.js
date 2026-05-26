import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const {
  DDNS_USER,
  DDNS_PASS,
  PANGOLIN_URL,
  PANGOLIN_TOKEN
} = process.env;

function checkAuth(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) return false;

  const decoded = Buffer.from(auth.split(" ")[1], "base64").toString();
  const [user, pass] = decoded.split(":");

  return user === DDNS_USER && pass === DDNS_PASS;
}

app.all("/ddns", async (req, res) => {
  if (!checkAuth(req)) return res.status(401).send("badauth");

  const hostname = req.query.hostname;
  const ip = req.query.myip;

  if (!hostname || !ip) return res.status(400).send("badrequest");

  try {
    // 1. Get zones
    const zones = await fetch(`${PANGOLIN_URL}/api/zones`, {
      headers: { Authorization: `Bearer ${PANGOLIN_TOKEN}` }
    }).then(r => r.json());

    const zone = zones.find(z => hostname.endsWith(z.domain));
    if (!zone) return res.status(404).send("nozone");

    // 2. Get records
    const records = await fetch(`${PANGOLIN_URL}/api/zones/${zone.id}/records`, {
      headers: { Authorization: `Bearer ${PANGOLIN_TOKEN}` }
    }).then(r => r.json());

    const record = records.find(r => r.name === hostname);
    if (!record) return res.status(404).send("norecord");

    if (record.value === ip) return res.send("nochg");

    // 3. Update record
    await fetch(`${PANGOLIN_URL}/api/zones/${zone.id}/records/${record.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${PANGOLIN_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ value: ip })
    });

    // 4. Sync
    await fetch(`${PANGOLIN_URL}/api/zones/${zone.id}/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PANGOLIN_TOKEN}` }
    });

    return res.send("good");
  } catch (err) {
    console.error(err);
    return res.status(500).send("servererror");
  }
});

app.listen(8081, () => console.log("DDNS service running on 8081"));
