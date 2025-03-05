import http from "k6/http";
import { sleep, check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { randomString } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";

const taskCreatedCount = new Counter("tasker_tasks_created");
const taskUpdateCount = new Counter("tasker_tasks_updated");
const taskErrorRate = new Rate("tasker_task_errors");
const taskResponseTime = new Trend("tasker_task_response_time");

export const options = {
  scenarios: {
    api_load_test: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 10 },
        { duration: "30s", target: 20 },
        { duration: "1m", target: 20 },
        { duration: "30s", target: 0 },
      ],
    },

    complex_operations: {
      executor: "constant-vus",
      vus: 5,
      duration: "2m",
      startTime: "3m",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
    tasker_task_response_time: ["p(95)<300"],
  },
};

const BASE_URL =
  __ENV.TASKER_URL || "http://tasker-test.k8s-5.sa" || "http://localhost:30001";

console.log(`Использую базовый URL для тестов: ${BASE_URL}`);

const taskIds = [];

export default function () {
  const userName = `user_${randomString(5)}`;

  const createTaskData = JSON.stringify({
    title: `Test task ${randomString(8)}`,
    description: `This is a performance test task created at ${new Date().toISOString()}`,
    priority: Math.floor(Math.random() * 3) + 1,
    status: "TODO",
  });

  const createTaskParams = {
    headers: {
      "Content-Type": "application/json",
      "User-Name": userName,
    },
  };

  const createResponse = http.post(
    `${BASE_URL}/api/tasks`,
    createTaskData,
    createTaskParams
  );

  const createTaskSuccess = check(createResponse, {
    "task created successfully": (r) => r.status === 201 || r.status === 200,
    "task has valid id": (r) => r.json("id") !== undefined,
  });

  if (createTaskSuccess) {
    taskCreatedCount.add(1);
    taskResponseTime.add(createResponse.timings.duration);

    try {
      const taskId = createResponse.json("id");
      if (taskId) {
        taskIds.push(taskId);
      }
    } catch (e) {
      console.error(`Ошибка при парсинге ответа: ${e.message}`);
      console.log(`Тело ответа: ${createResponse.body}`);
      taskErrorRate.add(1);
    }
  } else {
    taskErrorRate.add(1);
    console.log(
      `Ошибка создания задачи: ${createResponse.status} ${createResponse.body}`
    );
  }

  sleep(1);

  const listResponse = http.get(`${BASE_URL}/api/tasks`, {
    headers: { "User-Name": userName },
  });

  check(listResponse, {
    "list tasks successful": (r) => r.status === 200,
    "response is JSON": (r) =>
      r.headers["Content-Type"] &&
      r.headers["Content-Type"].includes("application/json"),
  });

  try {
    const responseBody = listResponse.json();
    check(responseBody, {
      "response contains tasks array": (data) => Array.isArray(data),
    });
  } catch (e) {
    console.log(`Ошибка при парсинге списка задач: ${e.message}`);
  }

  sleep(1);

  if (taskIds.length > 0) {
    const randomIndex = Math.floor(Math.random() * taskIds.length);
    const taskId = taskIds[randomIndex];

    const updateTaskData = JSON.stringify({
      status: "IN_PROGRESS",
      description: `Updated description at ${new Date().toISOString()}`,
    });

    const updateResponse = http.patch(
      `${BASE_URL}/api/tasks/${taskId}`,
      updateTaskData,
      {
        headers: {
          "Content-Type": "application/json",
          "User-Name": userName,
        },
      }
    );

    const updateSuccess = check(updateResponse, {
      "task updated successfully": (r) => r.status === 200,
    });

    if (updateSuccess) {
      taskUpdateCount.add(1);
    } else {
      taskErrorRate.add(1);
      console.log(
        `Ошибка обновления задачи: ${updateResponse.status} ${updateResponse.body}`
      );
    }
  }

  sleep(2);
}
