import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
dotenv.config();
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const queueUrl = process.env.SQS_QUEUE_URL;

export async function init() {
  const commandParams = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 10,
    VisibilityTimeout: 20,
  };
  while (true) {
    try {
      const command = new ReceiveMessageCommand(commandParams);
      const { Messages } = await sqsClient.send(command);

      if (!Messages || Messages.length === 0) {
        console.log(`No message in queue.`);
        continue;
      }
      for (const message of Messages) {
        const { MessageId, Body, ReceiptHandle } = message;
        console.log(`Message Received:`, { MessageId, Body });

        if (!Body) continue;

        let event;
        try {
          event = JSON.parse(Body);
        } catch (e) {
          console.error("Failed to parse message body as JSON:", e);
          continue;
        }

        if (event?.Event === "s3:TestEvent") {
          console.log("Skipping s3:TestEvent");
          await deleteMessage(ReceiptHandle);
          continue;
        }

        if (event.Records) {
          for (const record of event.Records) {
            const bucket = record.s3.bucket.name;
            const key = decodeURIComponent(
              record.s3.object.key.replace(/\+/g, " ")
            );
            console.log("S3 Object Created:", bucket, key);
          }
        }
        await deleteMessage(ReceiptHandle);
      }
    } catch (error) {
      console.error("Error receiving message:", error);
    }
  }
}
async function deleteMessage(receiptHandle) {
  try {
    const deleteParams = {
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    };
    const deleteCommand = new DeleteMessageCommand(deleteParams);
    await sqsClient.send(deleteCommand);
    console.log("Message deleted from queue");
  } catch (err) {
    console.error("Error deleting message:", err);
  }
}

init();
