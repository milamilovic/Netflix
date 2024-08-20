const { S3Client, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = new S3Client();

exports.handler = async (event) => {
    const bucketName = process.env.BUCKET_NAME;
    const id = event.queryStringParameters.id;

    const s3Params = {
        Bucket: bucketName,
        Key: id
    };

    /*try {*/
        const headParams = {
            Bucket: bucketName,
            Key: id
        };

        await s3Client.send(new HeadObjectCommand(headParams));

        await s3Client.send(new DeleteObjectCommand(s3Params));

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
              },
            body: JSON.stringify({ message: 'Video deleted successfully!' })
        };
    /*} catch (error) {
        console.error(error);
        if (error.name === 'NotFound') {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
                  },
                body: JSON.stringify({ message: 'Video not found in bucket' })
            };
        }
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
              },
            body: JSON.stringify({ message: 'Internal server error' })
        };
    }*/
};
