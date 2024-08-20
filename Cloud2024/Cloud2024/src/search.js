const { DynamoDBClient, QueryCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = new DynamoDBClient();

exports.handler = async (event) => {
    const tableName = process.env.TABLE_NAME;

    let queryParams = {};
    let requestJSON;

    /*try {*/
        requestJSON = JSON.parse(event.body);

        const title = requestJSON.title || "";
        const actors = requestJSON.actors || [];
        const directors = requestJSON.directors || [];
        const genres = requestJSON.genres || [];

        const hasTitle = Boolean(title);
        const hasActors = Array.isArray(actors) && actors.length > 0;
        const hasDirectors = Array.isArray(directors) && directors.length > 0;
        const hasGenres = Array.isArray(genres) && genres.length > 0;

        if (hasTitle && !hasActors && !hasDirectors && !hasGenres) {
            queryParams = {
                TableName: tableName,
                IndexName: "TitleIndex",
                KeyConditionExpression: "title = :title",
                ExpressionAttributeValues: { 
                    ":title": { S: title }
                }
            };
        } else if (hasTitle && hasActors && hasDirectors && hasGenres) {
            const combinedKey = `${title}#${actors.join(',')}#${directors.join(',')}#${genres.join(',')}`;
            queryParams = {
                TableName: tableName,
                IndexName: "CombinedIndex",
                KeyConditionExpression: "combinedKey = :combinedKey",
                ExpressionAttributeValues: { ":combinedKey": { S: combinedKey } }
            };
        } else {
            queryParams = {
                TableName: tableName,
                FilterExpression: "",
                ExpressionAttributeValues: {}
            };

            let filterExpressions = [];
            if (hasTitle) {
                filterExpressions.push("title = :title");
                queryParams.ExpressionAttributeValues[":title"] = { S: title };
            }
            if (hasActors) {
                filterExpressions.push(actors.map((_, index) => `contains(actors, :actor${index})`).join(" OR "));
                actors.forEach((actor, index) => {
                    queryParams.ExpressionAttributeValues[`:actor${index}`] = { S: actor };
                });
            }
            if (hasDirectors) {
                filterExpressions.push(directors.map((_, index) => `contains(directors, :director${index})`).join(" OR "));
                directors.forEach((director, index) => {
                    queryParams.ExpressionAttributeValues[`:director${index}`] = { S: director };
                });
            }
            if (hasGenres) {
                filterExpressions.push(genres.map((_, index) => `contains(genres, :genre${index})`).join(" OR "));
                genres.forEach((genre, index) => {
                    queryParams.ExpressionAttributeValues[`:genre${index}`] = { S: genre };
                });
            }

            queryParams.FilterExpression = filterExpressions.join(' AND ');
        }

        let response;
        if (queryParams.IndexName) {
            response = await dynamoDbClient.send(new QueryCommand(queryParams));
        } else {
            response = await dynamoDbClient.send(new ScanCommand(queryParams));
        }

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(response.Items)
        };

    /*} catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({ message: error.message })
        };
    }*/
};
