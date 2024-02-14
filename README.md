## 🔎 Overview

It is responsible for queuing requests to AI server. By separating it from the gateway server and managing it with cloud Functions, the logic of the gateway server has been simplified.

The gateway server triggers this function whenever a request is received, and the AI server triggers this function at the end of the task (regardless of success or failure, that is, whenever it is in the IDLE state).

## 🛠 Architecture

<img width="662" alt="image" src="https://github.com/RememberMe-2024-SolutionChallenge/AI-task-scheduler/assets/54667577/925788fa-4da1-428d-8103-caa971cd6ae0">

## ❓ Why didn't you use GCP Cloud Tasks?

Since the AI operation took more than 30 minutes, the HTTP timeout could not be satisfied. In addition, pub/sub was considered too over-spec to simply be used as a message broker. Therefore, I was able to be in charge of scheduling with Cloud Functions and Memory store.
