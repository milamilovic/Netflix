const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = new DynamoDBClient();

exports.handler = async (event) => {
    const tableName = process.env.TABLE_NAME;
    const parsedBody = JSON.parse(event.body);
    
    const movieId = parsedBody.movieId;
    const username = parsedBody.username;
    const downloadId = parsedBody.downloadId;

    const putItemParams = {
        TableName: tableName,
        Item: {
            downloadId: { S: downloadId },
            movieId: { S: movieId },
            username: { S: username },
            timestamp: { S: new Date().toISOString() }
        },
    };
    /*try {*/
        const putItemCommand = new PutItemCommand(putItemParams);
        await dynamoDbClient.send(putItemCommand);

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
            body: JSON.stringify({ message: 'Download saved successfully' }),
        };
    /*} catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
            body: JSON.stringify({ message: error.message }),
        };
    }*/
};
