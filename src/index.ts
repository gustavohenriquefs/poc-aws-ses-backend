import express from 'express';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import cors from 'cors';

const queueUrl = process.env.QUEUE_URL!;
const localstackEndpoint = process.env.LOCALSTACK_ENDPOINT!;
const region = process.env.AWS_REGION ?? 'us-east-1';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;
const accessKeyID = process.env.AWS_ACCESS_KEY_ID!;

dotenv.config();

const sqs = new AWS.SQS({
  endpoint: localstackEndpoint,
  region: region
});

const ses = new AWS.SES({
  secretAccessKey: secretAccessKey,
  accessKeyId: accessKeyID,
  region: region,
});

const app = express();
const port = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.post('/send-log', async (req, res) => {
  const { message } = req.body;

  if (typeof message !== 'string') {
    return res.status(400).send('Mensagem inválida');
  }

  const params = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify({ message })
  };

  try {
    await sqs.sendMessage(params).promise();
    res.status(200).send('Log enviado com sucesso');
  } catch (error) {
    res.status(500).send('Erro ao enviar log: ' + error);
  }
});

app.post('/send-email', express.json(), async (req, res) => {
  const { toAddress, subject, body } = req.body;

  const params = {
    Source: 'gustavohenriquefs.dev@gmail.com',
    Destination: {
      ToAddresses: [toAddress]
    },
    Message: {
      Subject: {
        Data: subject
      },
      Body: {
        Text: {
          Data: body
        }
      }
    }
  };

  try {
    await ses.sendEmail(params).promise().catch((error) => {
      console.error('Erro ao enviar e-mail:', error);
      throw error;
    });
    res.status(200).send('E-mail enviado com sucesso');
  } catch (error) {
    res.status(500).send('Erro ao enviar e-mail');
  }
});


app.get('/get-logs', async (req, res) => {
  const params = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10
  };

  try {
    const data = await sqs.receiveMessage(params).promise();
    const messages = data.Messages || [];

    if (messages.length > 0) {
      const deleteParams = {
        QueueUrl: queueUrl,
        Entries: messages.map(msg => ({
          Id: msg.MessageId!,
          ReceiptHandle: msg.ReceiptHandle!
        }))
      };

      await sqs.deleteMessageBatch(deleteParams).promise();
    }

    res.status(200).json(messages.map(msg => JSON.parse(msg.Body!)));
  } catch (error) {
    res.status(500).send('Erro ao recuperar logs');
  }
});

app.listen(port, () => {
  console.log(`Servidor backend rodando em http://localhost:${port}`);
});
