const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = new S3Client();

exports.handler = async (event) => {
  /*try {*/
    const s3Params = {
      Bucket: process.env.BUCKET_NAME,
      Key: event.queryStringParameters.id,
    };
    const { Body } = await s3Client.send(new GetObjectCommand(s3Params));
    let bodyBuffer;
    if (Body instanceof Buffer) {
      bodyBuffer = Body;
    } else {
      bodyBuffer = Buffer.from(await streamToBuffer(Body));
    }
    const bodyBase64 = bodyBuffer.toString('base64');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'video/mp4',
        "Access-Control-Allow-Origin": "*", // Required for CORS support to work
        "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
      },
      body: bodyBase64,
      isBase64Encoded: true
    };
  /*} catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }*/
};

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}
