const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDBClient = new DynamoDBClient();

exports.handler = async (event) => {
    const title = event.queryStringParameters.title;

    if (!title) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            },
            body: JSON.stringify({ message: 'Title is required' })
        };
    }

    /*try {*/
        const data = await dynamoDBClient.send(
            new QueryCommand({
                TableName: process.env.TABLE_NAME,
                IndexName: "TitleIndex",
                KeyConditionExpression: "title = :title",
                ExpressionAttributeValues: {
                  ":title": { S: title }
                }
              })
        );

        if (!data.Items || data.Items.length === 0) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
                },
                body: JSON.stringify( 'Title not found' )
            };
        }

        const item = data.Items[0];
        const isMovie = item.isMovie;

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            },
            body: JSON.stringify( isMovie )
        };

    /*} catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            },
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message })
        };
    }*/
};