const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDBClient = new DynamoDBClient();

exports.handler = async (event) => {
    const { title } = event.queryStringParameters;

    if (!title) {
        return {
            statusCode: 400,
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
        if (data.Items.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'No items found for the given title' })
            };
        }

        const formattedItems = data.Items.map(item => {
            const formattedItem = {
                fileName: item.fileName.S,
                episodeNumber: parseInt(item.episodeNumber.N, 10),
                uploadTimestamp: item.uploadTimestamp.S,
                seasonNumber: parseInt(item.seasonNumber.N, 10),
                actors: item.actors.SS,
                directors: item.directors.SS,
                genres: item.genres.SS,
                id: item.id.S,
                title: item.title.S,
                episodeTitle: item.episodeTitle.S,
                episodeDescription: item.episodeDescription.S,
                episodeThumbnail: item.episodeThumbnail.S,
                lastModified: item.lastModified.S,
                fileType: item.fileType.S,
                fileSizeMb: item.fileSizeMb.N,
                qualities: item.qualities.SS
            };

            if (item.description && item.description.S) {
                formattedItem.description = item.description.S;
            }
            if (item.thumbnailImage && item.thumbnailImage.S) {
                formattedItem.thumbnailImage = item.thumbnailImage.S;
            }

            return formattedItem;
        });

        return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              "Access-Control-Allow-Origin": "*", // Required for CORS support to work
              "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            },
            body: JSON.stringify(formattedItems)
        };

    /*} catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message })
        };
    }*/
};