const { DynamoDBClient, QueryCommand, ScanCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const dynamoDbClient = new DynamoDBClient();

exports.handler = async (event) => {
    const downloadHistoryTableName = process.env.DH_TABLE_NAME;
    const userRatingsTableName = process.env.UR_TABLE_NAME;
    const subscriptionsTableName = process.env.S_TABLE_NAME;
    const feedTableName = process.env.FEED_TABLE_NAME;
    const moviesTableName = process.env.M_TABLE_NAME;
    const parsedBody = JSON.parse(event.body);
    const username = parsedBody.username;

    // Define time ranges for scoring
    const oneDay = 24 * 60 * 60 * 1000;
    const threeDays = 3 * oneDay;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    // check username


    const downloadHistoryParams = {
        TableName: downloadHistoryTableName,
        IndexName: 'UsernameHistoryIndex',
        KeyConditionExpression: '#un = :username',
        ExpressionAttributeNames: {
            '#un': 'username'
        },
        ExpressionAttributeValues: {
            ':username': { S: username }
        }
    };

    const userRatingsParams = {
        TableName: userRatingsTableName,
        IndexName: 'UsernameIndex',
        KeyConditionExpression: '#un = :username',
        ExpressionAttributeNames: {
            '#un': 'username'
        },
        ExpressionAttributeValues: {
            ':username': { S: username }
        }
    };

    const subscriptionsParams = {
        TableName: subscriptionsTableName,
        IndexName: 'UsernameSubscriptionsIndex',
        KeyConditionExpression: '#un = :username',
        ExpressionAttributeNames: {
            '#un': 'username'
        },
        ExpressionAttributeValues: {
            ':username': { S: username }
        }
    };

    const allMoviesParams = {
        TableName: moviesTableName
      };

    /*try {*/
        const ratingsData = await dynamoDbClient.send(new QueryCommand(userRatingsParams));
        const ratingsItems = ratingsData.Items || [];

        const movieRatings = ratingsItems.map(item => ({
            movieId: item.movieId.S,
            rating: item.rating.S,
            timestamp: item.timestamp.S
        }));

        const downloadsData = await dynamoDbClient.send(new QueryCommand(downloadHistoryParams));
        const downloadsItems = downloadsData.Items || [];

        const downloads = downloadsItems.map(item => ({
            movieId: item.movieId.S,
            timestamp: item.timestamp.S
        }));

        const subscriptionsData = await dynamoDbClient.send(new QueryCommand(subscriptionsParams));
        const subscriptionsItems = subscriptionsData.Items || [];

        const subscriptions = subscriptionsItems.map(item => ({
            subscribedActors: item.subscribedActors.SS,
            subscribedDirectors: item.subscribedDirectors.SS,
            subscribedGenres: item.subscribedGenres.SS
        }));

        const command = new ScanCommand(allMoviesParams);
        const allMoviesItem = await dynamoDbClient.send(command);
        const allMovies = allMoviesItem.Items.map(item => {
            const movie = unmarshall(item);
            movie.actors = item.actors.SS;
            movie.genres = item.genres.SS;
            movie.directors = item.directors.SS;
            movie.qualities = item.qualities.SS;
            return movie;
        });

        const currentTime = new Date();

        // Calculate scores for all movies
        const movieScores = allMovies.map(movie => {
            let score = 0;
            console.info('MOVIEEEEEE ' + movie.title);

            // Check subscriptions
            subscriptions.forEach(sub => {
                if (movie.actors.some(actor => sub.subscribedActors.includes(actor))) {
                    score += 1;
                    console.info('subscriptions +1 score for actor ');
                }
                if (movie.directors.some(director => sub.subscribedDirectors.includes(director))) {
                    score += 1;
                    console.info('subscriptions +1 score for director ');
                }
                if (movie.genres.some(genre => sub.subscribedGenres.includes(genre))) {
                    score += 1;
                    console.info('subscriptions +1 score for genre ');
                }
            });

            // Check ratings
            movieRatings.forEach(rating => {
                const ratedMovie = allMovies.find(m => m.id === rating.movieId);
                if (ratedMovie) {
                    if (ratedMovie.actors.some(actor => movie.actors.includes(actor)) || 
                        ratedMovie.directors.some(director => movie.directors.includes(director)) || 
                        ratedMovie.genres.some(genre => movie.genres.includes(genre))) {
                        const ratingValue = rating.rating;
                        if (ratingValue === 'love') {
                            score += 2;
                            console.info('include actor or director or genre +2 score for rating love');
                        } else if (ratingValue === 'like') {
                            console.info('include actor or director or genre +1 score for rating like');
                            score += 1;
                        } else {
                            score -= 3;
                            console.info('include actor or director or genre -3 score for rating dislike');
                        }
                    }
                }
            });

            // Check downloads
            downloads.forEach(download => {
                const downloadedMovie = allMovies.find(m => m.id === download.movieId);
                if (downloadedMovie) {
                    if (downloadedMovie.actors.some(actor => movie.actors.includes(actor)) || 
                        downloadedMovie.directors.some(director => movie.directors.includes(director)) || 
                        downloadedMovie.genres.some(genre => movie.genres.includes(genre))) {
                        const timeDiff = currentTime - download.timestamp;
                        if (timeDiff <= oneDay) {
                            score += 5;
                            console.info('include actor or director or genre +5 score for downloading today');
                        } else if (timeDiff <= threeDays) {
                            score += 4;
                            console.info('include actor or director or genre +4 score for downloading three days ago');
                        } else if (timeDiff <= oneWeek) {
                            score += 3;
                            console.info('include actor or director or genre +3 score for downloading one week ago');
                        } else if (timeDiff <= oneMonth) {
                            score += 2;
                            console.info('include actor or director or genre +2 score for downloading one month ago');
                        } else {
                            score += 1;
                            console.info('include actor or director or genre +1 score for downloading');
                        }
                    }
                }
            });

            return { ...movie, score };
        });

        // Sort movies by score in descending order
        movieScores.sort((a, b) => b.score - a.score);

        // Get top 10 movie ids
        const topMovies = movieScores.slice(0, 10).map(movie => movie.id);

        const feedItem = {
            username: { S: username },
            movieIds: { SS: topMovies }
        };

        await dynamoDbClient.send(
            new PutItemCommand({
                TableName: feedTableName,
                Item: feedItem
            })
        );
        
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
            body: JSON.stringify(movieScores)
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
            body: JSON.stringify({ error: username })
        };
    }*/
}