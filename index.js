const functions = require("@google-cloud/functions-framework");
const axios = require("axios");
const redis = require("redis");
const send = require("./src/utils");

require("dotenv").config();

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`,
});

// 0. Setup CORS && Connect to `Redis Queue`
// 1. Check status of `AI Engine`.
// 2. Get the next task from `Redis Queue`.
// 3. Trigger `AI Engine` to process the next task.
// 4. Update current task and pop `Redis Queue`
// 5. Response to requestor

functions.http("engineTrigger", async (req, res) => {
  // 0. Setup CORS && Connect to `Redis Queue`
  res.set("Access-Control-Allow-Origin", "*");
  await redisClient.connect().catch(async (err) => {
    return await send(res, redisClient, 500, "Redis Queue: Error");
  });

  // 1. Check status of `AI Engine`.
  const response = await axios
    .get(process.env.AI_ENGINE_URL)
    .then(async (res) => {
      if (res.data.status !== "IDLE")
        return await send(res, redisClient, 400, "AI Engine: WORKING");
    })
    .catch(async (err) => {
      return await send(res, redisClient, 500, "AI Engine: Error");
    });

  // 2. Get the next task from `Redis Queue`.
  const taskId = (await redisClient.lRange("ai-queue", 0, -1))[0];
  if (taskId === undefined || taskId === null)
    return send(res, redisClient, 400, "Redis Queue: There is no next task.");

  // 3. Trigger `AI Engine` to process the next task.
  await axios
    .post(process.env.AI_ENGINE_URL + `/api/train/scene/${taskId}`)
    .catch(async (err) => {
      return send(res, redisClient, 500, "AI Engine: Error");
    });

  // 4. Update current task and pop `Redis Queue`
  await redisClient.set("ai-current-task", taskId);
  await redisClient.lPop("ai-queue");

  // 5. Response to requestor
  return send(res, redisClient, 200, "Successfully triggered.");
});
