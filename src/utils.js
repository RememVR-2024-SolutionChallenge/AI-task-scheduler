export async function send(res, redisClient, status, message) {
  await redisClient.quit();
  return res.status(status).send(message);
}
