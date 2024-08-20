const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDBClient = new DynamoDBClient();

exports.handler = async (event) => {
    const { title, episodeNumber, seasonNumber } = event.queryStringParameters;

    if (!title || !episodeNumber || !seasonNumber) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Title, episode number, and season number are required' })
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
                body: JSON.stringify(false),
                headers: {
                    'Content-Type': 'application/json',
                    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
                },
            };
        }

        const episodes = data.Items.map(item => ({
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
            qualities: item.qualities.SS,
            description: item.description && item.description.S ? item.description.S : null,
            thumbnailImage: item.thumbnailImage && item.thumbnailImage.S ? item.thumbnailImage.S : null
        }));

        const episode = episodes.find(ep => ep.episodeNumber === parseInt(episodeNumber, 10) && ep.seasonNumber === parseInt(seasonNumber, 10));

        if (!episode) {
            return {
                statusCode: 200,
                body: JSON.stringify(false),
                headers: {
                    'Content-Type': 'application/json',
                    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
                },
            };
        } else {
            return {
                statusCode: 200,
                body: JSON.stringify(true),
                headers: {
                    'Content-Type': 'application/json',
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Credentials": true,
                },
            };
        }

    /*} catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message })
        };
    }*/
};
