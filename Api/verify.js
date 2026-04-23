export default async function handler(req, res) {
  const { userId } = req.body;

  const user = await db.users.find(userId);

  if (!user || user.status !== "active") {
    return res.json({ valid: false });
  }

  return res.json({
    valid: true,
    plan: user.plan
  });
}