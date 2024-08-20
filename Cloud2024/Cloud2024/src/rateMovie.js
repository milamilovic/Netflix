const { DynamoDBClient, QueryCommand, PutItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = new DynamoDBClient();

exports.handler = async (event) => {
    const tableName = process.env.TABLE_NAME;
    const parsedBody = JSON.parse(event.body);
    
    const movieId = parsedBody.movieId;
    const rating = parsedBody.rating;
    const username = parsedBody.username;
    const ratingId = parsedBody.ratingId;

    const queryParams = {
        TableName: tableName,
        IndexName: "MovieRateIndex",
        KeyConditionExpression: "movieId = :movieId AND username = :username",
        ExpressionAttributeValues: {
            ":movieId": { S: movieId },
            ":username": { S: username }
        }
    };

    /*try {*/
        // Check if the user has already rated the movie
        const queryCommand = new QueryCommand(queryParams);
        const existingRatings = await dynamoDbClient.send(queryCommand);

        if (existingRatings.Items.length > 0) {
            // Update the existing rating
            const updateItemParams = {
                TableName: tableName,
                Key: {
                    ratingId: { S: existingRatings.Items[0].ratingId.S }
                },
                UpdateExpression: "SET rating = :rating",
                ExpressionAttributeValues: {
                    ":rating": { S: rating }
                }
            };

            const updateItemCommand = new UpdateItemCommand(updateItemParams);
            await dynamoDbClient.send(updateItemCommand);

            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
                },
                body: JSON.stringify({ message: 'Rating updated successfully' }),
            };
        } else {
            // Add the new rating
            const putItemParams = {
                TableName: tableName,
                Item: {
                    ratingId: { S: ratingId },
                    movieId: { S: movieId },
                    username: { S: username },
                    rating: { S: rating },
                    timestamp: { S: new Date().toISOString() }
                },
            };

            const putItemCommand = new PutItemCommand(putItemParams);
            await dynamoDbClient.send(putItemCommand);

            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
                },
                body: JSON.stringify({ message: 'Rating submitted successfully' }),
            };
        }
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
