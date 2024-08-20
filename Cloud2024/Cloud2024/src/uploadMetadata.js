const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const dynamoDbClient = new DynamoDBClient();
const sqsClient = new SQSClient()

exports.handler = async (event) => {
    const tableName = process.env.TABLE_NAME;
    const queueUrl = process.env.SQS_QUEUE_URL;

    let requestJSON
    /*try {*/
        requestJSON = JSON.parse(event.body);

        // Validate input
        if (!requestJSON.id || !requestJSON.fileName || !requestJSON.title) {
          throw new Error('Missing required fields');
        }

        const isTVShow = requestJSON.seasonNumber !== undefined && requestJSON.episodeNumber !== undefined;

        const combinedKey = `${requestJSON.title}#${requestJSON.actors.join(',')}#${requestJSON.directors.join(',')}#${requestJSON.genres.join(',')}`;

        const item = {
          id: { S: requestJSON.id },
          fileName: { S: requestJSON.fileName },
          title: { S: requestJSON.title },
          actors: { SS: requestJSON.actors },
          directors: { SS: requestJSON.directors },
          genres: { SS: requestJSON.genres },
          uploadTimestamp: { S: new Date().toISOString() },
          lastModified: { S: new Date().toISOString() },
          fileType: { S: requestJSON.fileType },
          fileSizeMb: { N: requestJSON.fileSizeMb.toString() },
          isMovie: { BOOL: true },
          qualities: {SS: requestJSON.qualities },
          combinedKey: { S: combinedKey }
        };

        if (requestJSON.description) {
          item.description = { S: requestJSON.description };
        }
        if (requestJSON.thumbnailImage) {
          item.thumbnailImage = { S: requestJSON.thumbnailImage };
        }
        
        if (isTVShow) {
          item.seasonNumber = { N: requestJSON.seasonNumber.toString() };
          item.episodeNumber = { N: requestJSON.episodeNumber.toString() };
          item.episodeTitle = { S: requestJSON.episodeTitle };
          item.episodeDescription = { S: requestJSON.episodeDescription };
          item.episodeThumbnail = { S: requestJSON.episodeThumbnail };
          item.isMovie = { BOOL: false };
        }

        await dynamoDbClient.send(
          new PutItemCommand({
            TableName: tableName,
            Item: item
          })
        );

        await sqsClient.send(new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(item)
        }));

        return {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*", // Required for CORS support to work
              "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            },
            body: JSON.stringify({ message: 'Metadata uploaded successfully!' })
        };
    /*} catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: {
              "Access-Control-Allow-Origin": "*", // Required for CORS support to work
              "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            },
            body: JSON.stringify({ message: error.message })
        };
    }*/
};


