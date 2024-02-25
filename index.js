const functions = require("@google-cloud/functions-framework");
const axios = require("axios");
const redis = require("redis");
const send = require("./src/utils");

require("dotenv").config();

// 0. Setup CORS && Connect to `Redis Queue`
// 1. Check status of `AI Engine`.
// 2. Get the next task from `Redis Queue`.
// 3. Update current task and pop `Redis Queue`
// 4. Trigger `AI Engine` to process the next task.
// 5. Response to requestor

functions.http("engineTrigger", async (req, res) => {
  console.log("AI Engine triggering process has started.");
  console.log("redis client connecting...");
  const redisClient = await redis.createClient({
    url: `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`,
  });

  // 0. Setup CORS && Connect to `Redis Queue`
  res.set("Access-Control-Allow-Origin", "*");
  try {
    await redisClient.connect();
  } catch (err) {
    return await send(res, redisClient, 500, "Redis Queue: Error");
  }
  console.log("Stage 0 Finished");

  // 1. Check status of `AI Engine`.
  try {
    const aiEngineStatus = await axios.get(process.env.AI_ENGINE_URL);
    if (aiEngineStatus.data.status !== "IDLE") {
      return await send(res, redisClient, 400, "AI Engine: WORKING");
    }
  } catch (err) {
    return await send(res, redisClient, 500, "AI Engine: Error (GET /)");
  }
  console.log("Stage 1 Finished");

  // 2. Get the next task from `Redis Queue`.
  let taskId;
  try {
    taskId = (await redisClient.lRange("ai-queue", 0, -1))[0];
    if (taskId === undefined || taskId === null) {
      return send(res, redisClient, 404, "Redis Queue: There is no next task.");
    }
  } catch (err) {
    return await send(
      res,
      redisClient,
      500,
      "Redis Queue: Error getting next task."
    );
  }
  console.log("Stage 2 Finished");

  // 3. Update current task and pop `Redis Queue`
  await redisClient.set("ai-current-task", taskId);
  await redisClient.lPop("ai-queue");
  console.log("Stage 3 Finished");

  // 4. Trigger `AI Engine` to process the next task.
  try {
    await axios.post(process.env.AI_ENGINE_URL + `/api/train/${taskId}`);
  } catch (err) {
    return send(res, redisClient, 500, "AI Engine: Error (POST /train)");
  }
  console.log("Stage 4 Finished");

  // 5. Response to requestor
  console.log("AI Engine Successfully Triggered.", taskId);
  return send(res, redisClient, 200, "Successfully triggered.");
});
