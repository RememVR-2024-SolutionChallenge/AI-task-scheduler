const functions = require("@google-cloud/functions-framework");
const axios = require("axios");
const redis = require("redis");

require("dotenv").config();

const { send } = require("./src/utils");

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`,
});

functions.http("engineTrigger", async (req, res) => {
  // 0. Connect to `Redis Queue`
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

  // 3. Update current task and pop `Redis Queue`
  await redisClient.set("ai-current-task", taskId);
  await redisClient.lPop("ai-queue");

  // 4. Trigger `AI Engine` to process the next task.
  await axios
    .post(process.env.AI_ENGINE_URL, { taskId: taskId })
    .catch(async (err) => {
      return send(res, redisClient, 500, "AI Engine: Error");
    });

  // 5. Response to requestor
  return send(res, redisClient, 200, "Successfully triggered.");
});
