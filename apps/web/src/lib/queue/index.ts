import { Redis } from "@upstash/redis";
import { log } from "@/lib/logger";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export type JobType = "email" | "print_receipt" | "sms_notification";

export interface BackgroundJob {
  id: string;
  type: JobType;
  payload: any;
  createdAt: number;
}

/**
 * Enqueue a background job into Redis List.
 */
export async function enqueueJob(type: JobType, payload: any) {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    log.warn("Redis not configured, skipping background job", { type });
    return false;
  }

  const job: BackgroundJob = {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: Date.now(),
  };

  try {
    await redis.lpush("orderflow:jobs:queue", JSON.stringify(job));
    log.info("Job enqueued", { id: job.id, type });
    return true;
  } catch (err: any) {
    log.error("Failed to enqueue job", { error: err.message, type });
    return false;
  }
}

/**
 * Process the next job in the queue (e.g., called by a cron or worker process).
 */
export async function processQueueBatch(batchSize: number = 5) {
  if (!process.env.UPSTASH_REDIS_REST_URL) return;

  const jobsStr = await redis.rpop("orderflow:jobs:queue", batchSize);
  // upstash rpop with count returns an array, or null if empty
  if (!jobsStr || (Array.isArray(jobsStr) && jobsStr.length === 0)) {
    return 0; // No jobs
  }

  const jobs = Array.isArray(jobsStr) ? jobsStr : [jobsStr];
  let processedCount = 0;

  for (const jobData of jobs) {
    let job: BackgroundJob;
    try {
      job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData;
    } catch {
      continue;
    }

    try {
      // Basic router
      switch (job.type) {
        case "email":
          // await processEmailJob(job.payload);
          break;
        case "print_receipt":
          // await processPrintJob(job.payload);
          break;
        default:
          log.warn("Unknown job type", { type: job.type });
      }
      processedCount++;
    } catch (err: any) {
      log.error("Job processing failed", { id: job.id, error: err.message });
      // In a real system, move to a Dead Letter Queue (DLQ)
      await redis.lpush("orderflow:jobs:dlq", JSON.stringify(job));
    }
  }

  return processedCount;
}
