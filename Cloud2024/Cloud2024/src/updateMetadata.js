const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = new DynamoDBClient();
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const sqsClient = new SQSClient()

exports.handler = async (event) => {
    const tableName = process.env.TABLE_NAME;
    const queueUrl = process.env.SQS_QUEUE_URL;

    let requestJSON;
    /*try {*/
        requestJSON = JSON.parse(event.body);
        
        const isTVShow = requestJSON.seasonNumber !== undefined && requestJSON.episodeNumber !== undefined;

        const combinedKey = `${requestJSON.title}#${requestJSON.actors.join(',')}#${requestJSON.directors.join(',')}#${requestJSON.genres.join(',')}`;

        let updateExpression = 'SET fileName = :fileName, title = :title, actors = :actors, directors = :directors, genres = :genres, fileType = :fileType, fileSizeMb = :fileSizeMb, combinedKey = :combinedKey, qualities = :qualities';
        let expressionAttributeValues = {
            ':fileName': { S: requestJSON.fileName },
            ':title': { S: requestJSON.title },
            ':actors': { SS: requestJSON.actors },
            ':directors': { SS: requestJSON.directors },
            ':genres': { SS: requestJSON.genres },
            ':fileType': { S: requestJSON.fileType },
            ':fileSizeMb': { N: requestJSON.fileSizeMb.toString() },
            ':combinedKey': { S: combinedKey },
            ':qualities': { SS: requestJSON.qualities }
        };

        if (requestJSON.description) {
            updateExpression += ', description = :description';
            expressionAttributeValues[':description'] = { S: requestJSON.description };
        }
        if (requestJSON.thumbnailImage) {
            updateExpression += ', thumbnailImage = :thumbnailImage';
            expressionAttributeValues[':thumbnailImage'] = { S: requestJSON.thumbnailImage };
        }

        if (isTVShow) {
            updateExpression += ', seasonNumber = :seasonNumber, episodeNumber = :episodeNumber, episodeTitle = :episodeTitle, episodeDescription = :episodeDescription, episodeThumbnail = :episodeThumbnail';
            expressionAttributeValues[':seasonNumber'] = { N: requestJSON.seasonNumber.toString() };
            expressionAttributeValues[':episodeNumber'] = { N: requestJSON.episodeNumber.toString() };
            expressionAttributeValues[':episodeTitle'] = { S: requestJSON.episodeTitle };
            if (requestJSON.episodeDescription) {
                expressionAttributeValues[':episodeDescription'] = { S: requestJSON.episodeDescription };
            } else {
                updateExpression = updateExpression.replace(', episodeDescription = :episodeDescription', '');
            }
            if (requestJSON.episodeThumbnail) {
                expressionAttributeValues[':episodeThumbnail'] = { S: requestJSON.episodeThumbnail };
            } else {
                updateExpression = updateExpression.replace(', episodeThumbnail = :episodeThumbnail', '');
            }
        }

        updateExpression += ', lastModified = :lastModified';
        expressionAttributeValues[':lastModified'] = { S: new Date().toISOString() };

        const params = {
            TableName: tableName,
            Key: {
                id: { S: requestJSON.id }
            },
            UpdateExpression: updateExpression,
            ConditionExpression: 'attribute_exists(id)',
            ExpressionAttributeValues: expressionAttributeValues
        };

        await dynamoDbClient.send(new UpdateItemCommand(params));

        const messageBody = JSON.stringify({
            id: { S: requestJSON.id },
            fileName: { S: requestJSON.fileName },
            title: { S: requestJSON.title },
            actors: { SS: requestJSON.actors },
            directors: { SS: requestJSON.directors },
            genres: { SS: requestJSON.genres },
            fileType: { S: requestJSON.fileType },
            fileSizeMb: { N: requestJSON.fileSizeMb.toString() },
            lastModified: { S: new Date().toISOString() },
            combinedKey: { S: combinedKey },
            qualities: { SS: requestJSON.qualities },
            ...(requestJSON.description && { description: { S: requestJSON.description } }),
            ...(requestJSON.thumbnailImage && { thumbnailImage: { S: requestJSON.thumbnailImage } }),
            ...(isTVShow && {
                seasonNumber: { N: requestJSON.seasonNumber.toString() },
                episodeNumber: { N: requestJSON.episodeNumber.toString() },
                episodeTitle: { S: requestJSON.episodeTitle },
                episodeDescription: requestJSON.episodeDescription ? { S: requestJSON.episodeDescription } : undefined,
                episodeThumbnail: requestJSON.episodeThumbnail ? { S: requestJSON.episodeThumbnail } : undefined
            })
        });

        await sqsClient.send(new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: messageBody
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Metadata updated successfully!' }),
            headers: {
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
              },
        };
    /*} catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
              },
            body: JSON.stringify({ message: 'Failed to update metadata', error: error.message }),
            
        };
    }*/
};
