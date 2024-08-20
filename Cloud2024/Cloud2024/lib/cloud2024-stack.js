"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cloud2024Stack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const s3 = require("aws-cdk-lib/aws-s3");
const cognito = require("aws-cdk-lib/aws-cognito");
const iam = require("aws-cdk-lib/aws-iam");
const sqs = require("aws-cdk-lib/aws-sqs");
const lambdaEventSources = require("aws-cdk-lib/aws-lambda-event-sources");
const path = require("path");
class Cloud2024Stack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const preRegisterFunction = new lambda.Function(this, "preRegisterFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "preRegister.handler",
        });
        const userPool = new cognito.UserPool(this, "MovieUserPool", {
            selfSignUpEnabled: true,
            autoVerify: { email: true },
            signInAliases: { username: true },
            lambdaTriggers: {
                preSignUp: preRegisterFunction,
            },
            customAttributes: {
                role: new cognito.StringAttribute({ mutable: true }),
            },
        });
        const userPoolClient = new cognito.UserPoolClient(this, "MovieUserPoolClient", {
            userPool,
            authFlows: {
                userPassword: true,
            },
        });
        const authorizeAdminFunction = new lambda.Function(this, 'AuthorizeAdminFunction', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'adminAuthorizer.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, "../src/python-lambdas"), {
                bundling: {
                    image: lambda.Runtime.PYTHON_3_8.bundlingImage,
                    command: [
                        "bash",
                        "-c",
                        "pip install -r requirements.txt -t /asset-output && cp -r . /asset-output",
                    ],
                },
            }),
            environment: {
                USER_POOL_ID: userPool.userPoolId,
                CLIENT_ID: userPoolClient.userPoolClientId,
            },
        });
        const authorizeUserFunction = new lambda.Function(this, 'AuthorizeUserFunction', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'userAuthorizer.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, "../src/python-lambdas"), {
                bundling: {
                    image: lambda.Runtime.PYTHON_3_8.bundlingImage,
                    command: [
                        "bash",
                        "-c",
                        "pip install -r requirements.txt -t /asset-output && cp -r . /asset-output",
                    ],
                },
            }),
            environment: {
                USER_POOL_ID: userPool.userPoolId,
                CLIENT_ID: userPoolClient.userPoolClientId,
            },
        });
        const authorizeFunction = new lambda.Function(this, 'AuthorizeFunction', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'authorizer.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, "../src/python-lambdas"), {
                bundling: {
                    image: lambda.Runtime.PYTHON_3_8.bundlingImage,
                    command: [
                        "bash",
                        "-c",
                        "pip install -r requirements.txt -t /asset-output && cp -r . /asset-output",
                    ],
                },
            }),
            environment: {
                USER_POOL_ID: userPool.userPoolId,
                CLIENT_ID: userPoolClient.userPoolClientId,
            },
        });
        const adminAuthorizer = new apigateway.TokenAuthorizer(this, 'admin-authorizer', {
            handler: authorizeAdminFunction,
            resultsCacheTtl: cdk.Duration.seconds(0)
        });
        const userAuthorizer = new apigateway.TokenAuthorizer(this, 'user-authorizer', {
            handler: authorizeUserFunction,
            resultsCacheTtl: cdk.Duration.seconds(0)
        });
        const bothAuthorizer = new apigateway.TokenAuthorizer(this, 'both-authorizer', {
            handler: authorizeFunction,
            resultsCacheTtl: cdk.Duration.seconds(0)
        });
        const bucket = new s3.Bucket(this, "MovieBucket", {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const helperBucket = new s3.Bucket(this, "TranscodingBucket", {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        bucket.addLifecycleRule({
            expiration: cdk.Duration.days(1), // Expire objects
            abortIncompleteMultipartUploadAfter: cdk.Duration.days(1), // Abort incomplete uploads
        });
        const table = new dynamodb.Table(this, "MovieTable", {
            partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const ratingsTable = new dynamodb.Table(this, "RatingsTable", {
            partitionKey: {
                name: "ratingId",
                type: dynamodb.AttributeType.STRING,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const historyTable = new dynamodb.Table(this, "DownloadHistoryTable", {
            partitionKey: {
                name: "downloadId",
                type: dynamodb.AttributeType.STRING,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const subscriptionsTable = new dynamodb.Table(this, "SubscriptionsTable", {
            partitionKey: {
                name: "userId",
                type: dynamodb.AttributeType.STRING,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableName: "SubscriptionsTable",
        });
        const feedTable = new dynamodb.Table(this, "FeedTable", {
            partitionKey: {
                name: "username",
                type: dynamodb.AttributeType.STRING,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const notificationsQueue = new sqs.Queue(this, "NotificationQueue", {
            visibilityTimeout: cdk.Duration.seconds(300),
        });
        const transcodingQueue = new sqs.Queue(this, "TranscodingQueue", {
            visibilityTimeout: cdk.Duration.seconds(500),
        });
        const feedQueue = new sqs.Queue(this, "FeedQueue", {
            visibilityTimeout: cdk.Duration.seconds(500),
        });
        // Adding a Global Secondary Index (GSI) for fileName
        table.addGlobalSecondaryIndex({
            indexName: "FileNameIndex",
            partitionKey: {
                name: "fileName",
                type: dynamodb.AttributeType.STRING,
            },
        });
        table.addGlobalSecondaryIndex({
            indexName: "CombinedIndex",
            partitionKey: {
                name: "combinedKey",
                type: dynamodb.AttributeType.STRING,
            },
        });
        // GSI for movie id
        ratingsTable.addGlobalSecondaryIndex({
            indexName: "MovieRateIndex",
            partitionKey: {
                name: "movieId",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "username",
                type: dynamodb.AttributeType.STRING,
            },
        });
        ratingsTable.addGlobalSecondaryIndex({
            indexName: "UsernameIndex",
            partitionKey: {
                name: "username",
                type: dynamodb.AttributeType.STRING,
            },
        });
        subscriptionsTable.addGlobalSecondaryIndex({
            indexName: "UsernameSubscriptionsIndex",
            partitionKey: {
                name: "username",
                type: dynamodb.AttributeType.STRING,
            },
        });
        historyTable.addGlobalSecondaryIndex({
            indexName: "UsernameHistoryIndex",
            partitionKey: {
                name: "username",
                type: dynamodb.AttributeType.STRING,
            },
        });
        const loginFunction = new lambda.Function(this, "loginFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "login.handler",
            environment: {
                COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
                COGNITO_USER_POOL_ID: userPool.userPoolId,
            },
        });
        const registerFunction = new lambda.Function(this, "registerFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "register.handler",
            environment: {
                COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
                COGNITO_USER_POOL_ID: userPool.userPoolId,
            },
        });
        const checkUsernameFunction = new lambda.Function(this, "checkUsernameFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "checkUsername.handler",
            environment: {
                COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
                COGNITO_USER_POOL_ID: userPool.userPoolId,
            },
        });
        const adminGetUserPolicy = new iam.PolicyStatement({
            actions: ["cognito-idp:AdminGetUser"],
            resources: [userPool.userPoolArn],
        });
        checkUsernameFunction.addToRolePolicy(adminGetUserPolicy);
        // Adding a Global Secondary Index (GSI) for title
        table.addGlobalSecondaryIndex({
            indexName: "TitleIndex",
            partitionKey: {
                name: "title",
                type: dynamodb.AttributeType.STRING,
            },
        });
        const uploadMetadataFunction = new lambda.Function(this, "uploadMetadataFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "uploadMetadata.handler",
            environment: {
                TABLE_NAME: table.tableName,
                SQS_QUEUE_URL: notificationsQueue.queueUrl,
            },
        });
        const downloadMovieFunction = new lambda.Function(this, "downloadMovieFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "downloadMovie.handler",
            environment: {
                BUCKET_NAME: bucket.bucketName,
            },
        });
        const downloadMetadataFunction = new lambda.Function(this, "downloadMetadataFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "downloadMetadata.handler",
            environment: {
                TABLE_NAME: table.tableName,
            },
        });
        const updateMetadataFunction = new lambda.Function(this, "updateMetadataFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "updateMetadata.handler",
            environment: {
                TABLE_NAME: table.tableName,
                SQS_QUEUE_URL: notificationsQueue.queueUrl,
            },
        });
        const transcodingLambda = new lambda.Function(this, "transcodingLambda", {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: "transcodingLambda.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "../src/python-lambdas"), {
                bundling: {
                    image: lambda.Runtime.PYTHON_3_8.bundlingImage,
                    command: [
                        "bash",
                        "-c",
                        "pip install -r requirements.txt -t /asset-output && cp -r . /asset-output",
                    ],
                },
            }),
            environment: {
                PATH: "/var/task/bin",
                BUCKET_NAME: bucket.bucketName,
                HELPER_BUCKET_NAME: helperBucket.bucketName,
                SQS_QUEUE_URL: transcodingQueue.queueUrl,
            },
            timeout: cdk.Duration.seconds(60),
            memorySize: 1024,
            ephemeralStorageSize: cdk.Size.mebibytes(1024),
        });
        transcodingLambda.addEventSource(new lambdaEventSources.SqsEventSource(transcodingQueue));
        const uploadMovieFunction = new lambda.Function(this, "uploadMovieFunction", {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: "uploadMovie.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "../src/python-lambdas")),
            environment: {
                PATH: "/var/task/bin",
                SQS_QUEUE_URL: transcodingQueue.queueUrl,
                HELPER_BUCKET_NAME: helperBucket.bucketName,
            },
            timeout: cdk.Duration.seconds(60),
            memorySize: 1024,
            ephemeralStorageSize: cdk.Size.mebibytes(1024),
        });
        const downloadMetadataByFileNameFunction = new lambda.Function(this, "downloadMetadataByFileNameFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "downloadMetadataByFileName.handler",
            environment: {
                TABLE_NAME: table.tableName,
            },
        });
        const checkIfMovieFunction = new lambda.Function(this, "checkIfMovieFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "checkIfMovie.handler",
            environment: {
                TABLE_NAME: table.tableName,
            },
        });
        const checkIfEpisodeExistsFunction = new lambda.Function(this, "checkIfEpisodeExistsFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "checkIfEpisodeExists.handler",
            environment: {
                TABLE_NAME: table.tableName,
            },
        });
        const downloadMetadataForTvShowFunction = new lambda.Function(this, "downloadMetadataForTvShowFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "downloadMetadataForTvShow.handler",
            environment: {
                TABLE_NAME: table.tableName,
            },
        });
        const deleteMetadataFunction = new lambda.Function(this, "deleteMetadataFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "deleteMetadata.handler",
            environment: {
                TABLE_NAME: table.tableName,
            },
        });
        const updateMovieFunction = new lambda.Function(this, "updateMovieFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "updateMovie.handler",
            environment: {
                BUCKET_NAME: bucket.bucketName,
            },
        });
        const deleteMovieFunction = new lambda.Function(this, "deleteMovieFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "deleteMovie.handler",
            environment: {
                BUCKET_NAME: bucket.bucketName,
            },
        });
        const rateMovieFunction = new lambda.Function(this, "rateMovieFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "rateMovie.handler",
            environment: {
                TABLE_NAME: ratingsTable.tableName,
            },
        });
        const getMovieRatingFunction = new lambda.Function(this, "getMovieRatingFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "getMovieRating.handler",
            environment: {
                TABLE_NAME: ratingsTable.tableName,
            },
        });
        const getUserRatingsFunction = new lambda.Function(this, "getUserRatingsFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "getUserRatings.handler",
            environment: {
                TABLE_NAME: ratingsTable.tableName,
            },
        });
        const downloadHistoryFunction = new lambda.Function(this, "downloadHistoryFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "downloadHistory.handler",
            environment: {
                TABLE_NAME: historyTable.tableName,
            },
        });
        const getUserHistoryFunction = new lambda.Function(this, "getUserDownloadHistoryFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "getDownloadHistory.handler",
            environment: {
                TABLE_NAME: historyTable.tableName,
            },
        });
        const subscribeFunction = new lambda.Function(this, "subscribeFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "subscribe.handler",
            environment: {
                SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
            },
        });
        const getSubscriptionsFunction = new lambda.Function(this, "getSubscriptionsFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "getSubscriptions.handler",
            environment: {
                SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
            },
        });
        const getSubscriptionsByUsernameFunction = new lambda.Function(this, "getSubscriptionsByUsernameFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "getSubscriptionsByUsername.handler",
            environment: {
                TABLE_NAME: subscriptionsTable.tableName,
            },
        });
        const sendNotificationFunction = new lambda.Function(this, "sendNotificationFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "sendNotification.handler",
            environment: {
                SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
            },
        });
        const generateFeedFunction = new lambda.Function(this, "generateFeedFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "generateFeed.handler",
            environment: {
                FEED_TABLE_NAME: feedTable.tableName,
                M_TABLE_NAME: table.tableName,
                S_TABLE_NAME: subscriptionsTable.tableName,
                DH_TABLE_NAME: historyTable.tableName,
                UR_TABLE_NAME: ratingsTable.tableName,
            },
        });
        const getFeedFunction = new lambda.Function(this, "getFeedFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "getFeed.handler",
            environment: {
                TABLE_NAME: feedTable.tableName,
            },
        });
        const invokeLambda = new lambda.Function(this, "InvokeFeedFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "generateFeedForAll.handler",
            code: lambda.Code.fromAsset("src"),
            environment: {
                FEED_TABLE_NAME: feedTable.tableName,
            },
        });
        const searchFunction = new lambda.Function(this, "searchFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset("src"),
            handler: "search.handler",
            environment: {
                TABLE_NAME: table.tableName,
            },
        });
        sendNotificationFunction.addEventSource(new lambdaEventSources.SqsEventSource(notificationsQueue, {
            batchSize: 10, // Number of messages to process per invocation
        }));
        table.grantReadWriteData(uploadMetadataFunction);
        table.grantReadWriteData(updateMetadataFunction);
        table.grantReadWriteData(deleteMetadataFunction);
        table.grantReadData(downloadMetadataFunction);
        table.grantReadData(downloadMetadataFunction);
        table.grantReadData(checkIfMovieFunction);
        table.grantReadData(checkIfEpisodeExistsFunction);
        table.grantReadData(downloadMetadataForTvShowFunction);
        table.grantReadData(generateFeedFunction);
        table.grantReadData(searchFunction);
        bucket.grantReadWrite(uploadMovieFunction);
        bucket.grantRead(downloadMovieFunction);
        bucket.grantReadWrite(updateMovieFunction);
        bucket.grantReadWrite(deleteMovieFunction);
        table.grantReadData(downloadMetadataByFileNameFunction);
        ratingsTable.grantReadWriteData(rateMovieFunction);
        ratingsTable.grantReadData(getMovieRatingFunction);
        ratingsTable.grantReadData(getUserRatingsFunction);
        ratingsTable.grantReadData(generateFeedFunction);
        subscriptionsTable.grantReadWriteData(subscribeFunction);
        subscriptionsTable.grantReadWriteData(sendNotificationFunction);
        subscriptionsTable.grantReadData(getSubscriptionsFunction);
        subscriptionsTable.grantReadData(getSubscriptionsByUsernameFunction);
        subscriptionsTable.grantReadData(generateFeedFunction);
        notificationsQueue.grantSendMessages(uploadMetadataFunction);
        notificationsQueue.grantSendMessages(updateMetadataFunction);
        notificationsQueue.grantConsumeMessages(sendNotificationFunction);
        transcodingQueue.grantConsumeMessages(transcodingLambda);
        transcodingQueue.grantSendMessages(uploadMovieFunction);
        helperBucket.grantWrite(uploadMovieFunction);
        helperBucket.grantRead(transcodingLambda);
        historyTable.grantReadData(getUserHistoryFunction);
        historyTable.grantReadWriteData(downloadHistoryFunction);
        historyTable.grantReadData(generateFeedFunction);
        feedTable.grantReadWriteData(generateFeedFunction);
        feedTable.grantReadData(getFeedFunction);
        feedTable.grantReadData(invokeLambda);
        const api = new apigateway.RestApi(this, "MovieApi", {
            restApiName: "Movie Service",
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ["*"],
                allowCredentials: true,
            },
        });
        const loginIntegration = new apigateway.LambdaIntegration(loginFunction);
        const registerIntegration = new apigateway.LambdaIntegration(registerFunction);
        const checkUsernameIntegration = new apigateway.LambdaIntegration(checkUsernameFunction);
        const uploadMetadataIntegration = new apigateway.LambdaIntegration(uploadMetadataFunction);
        const downloadMovieIntegration = new apigateway.LambdaIntegration(downloadMovieFunction);
        const downloadMetadataIntegration = new apigateway.LambdaIntegration(downloadMetadataFunction);
        const updateMetadataIntegration = new apigateway.LambdaIntegration(updateMetadataFunction);
        const deleteMetadataIntegration = new apigateway.LambdaIntegration(deleteMetadataFunction);
        const updateMovieIntegration = new apigateway.LambdaIntegration(updateMovieFunction);
        const deleteMovieIntegration = new apigateway.LambdaIntegration(deleteMovieFunction);
        const downloadMetadataByFileNameIntegration = new apigateway.LambdaIntegration(downloadMetadataByFileNameFunction);
        const checkIfMovieIntegration = new apigateway.LambdaIntegration(checkIfMovieFunction);
        const checkIfEpisodeExistsIntegration = new apigateway.LambdaIntegration(checkIfEpisodeExistsFunction);
        const downloadMetadataForTvShowIntegration = new apigateway.LambdaIntegration(downloadMetadataForTvShowFunction);
        const rateMovieIntegration = new apigateway.LambdaIntegration(rateMovieFunction);
        const getMovieRatingIntegration = new apigateway.LambdaIntegration(getMovieRatingFunction);
        const getUserRatingsIntegration = new apigateway.LambdaIntegration(getUserRatingsFunction);
        const downloadHistoryIntegration = new apigateway.LambdaIntegration(downloadHistoryFunction);
        const getUserHistoryIntegration = new apigateway.LambdaIntegration(getUserHistoryFunction);
        const subscribeIntegration = new apigateway.LambdaIntegration(subscribeFunction);
        const getSubscriptionsIntegration = new apigateway.LambdaIntegration(getSubscriptionsFunction);
        const getSubscriptionsByUsernameIntegration = new apigateway.LambdaIntegration(getSubscriptionsByUsernameFunction);
        const sendNotificationIntegration = new apigateway.LambdaIntegration(sendNotificationFunction);
        const generateFeedIntegration = new apigateway.LambdaIntegration(generateFeedFunction);
        const getFeedIntegration = new apigateway.LambdaIntegration(getFeedFunction);
        const invokeIntegration = new apigateway.LambdaIntegration(invokeLambda);
        const searchIntegration = new apigateway.LambdaIntegration(searchFunction);
        //transcoding
        bucket.grantReadWrite(transcodingLambda);
        /*const transcodingIntegration = new apigateway.LambdaIntegration(
            transcodingLambda
        );*/
        const uploadMovieIntegration = new apigateway.LambdaIntegration(uploadMovieFunction);
        const transcoding = api.root.addResource("transcoding");
        const transcode = transcoding.addResource("transcode");
        transcode.addMethod("POST", uploadMovieIntegration);
        const movies = api.root.addResource("movies");
        const moviesMetadata = movies.addResource("metadata");
        const moviesVideo = movies.addResource("video");
        const login = api.root.addResource("login");
        const register = api.root.addResource("register");
        const checkUsername = register.addResource("checkUsername");
        const rate = movies.addResource("rate");
        const movieRating = movies.addResource("rating");
        const userRatings = movies.addResource("ratings");
        const download = movies.addResource("downloadHistory");
        const userHistory = movies.addResource("downloads");
        const subscribe = api.root.addResource("subscribe");
        const subscriptions = api.root.addResource("subscribtionsByUsername");
        const notifications = api.root.addResource("notifications");
        const generateFeed = api.root.addResource("generateFeed");
        const generateFeedForAll = api.root.addResource("generateFeedForAll");
        const feed = api.root.addResource("home");
        const search = movies.addResource("search");
        moviesMetadata.addMethod("POST", uploadMetadataIntegration);
        moviesMetadata.addMethod("PUT", updateMetadataIntegration, { authorizer: adminAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM, });
        moviesMetadata.addMethod("DELETE", deleteMetadataIntegration);
        moviesVideo.addMethod("PUT", updateMovieIntegration, { authorizer: adminAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM, });
        moviesVideo.addMethod("DELETE", deleteMovieIntegration, { authorizer: adminAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM, });
        subscribe.addMethod("POST", subscribeIntegration);
        subscribe.addMethod("GET", getSubscriptionsIntegration);
        notifications.addMethod("POST", sendNotificationIntegration);
        search.addMethod("POST", searchIntegration, { authorizer: bothAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM, });
        const downloadMovie = movies.addResource("downloadMovie");
        const downloadMetadata = movies.addResource("downloadMetadata");
        const downloadMetadataByFileName = movies.addResource("downloadMetadataByFileName");
        const checkIfMovie = movies.addResource("checkIfMovie");
        const checkIfEpisodeExists = movies.addResource("checkEpisode");
        const downloadMetadataTvShow = movies.addResource("downloadMetadataTvShow");
        downloadMovie.addMethod("GET", downloadMovieIntegration, {
            requestParameters: {
                "method.request.querystring.id": true,
            }
        });
        downloadMetadata.addMethod("GET", downloadMetadataIntegration, {
            requestParameters: {
                "method.request.querystring.id": true,
            },
            authorizer: bothAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
        });
        downloadMetadataByFileName.addMethod("GET", downloadMetadataByFileNameIntegration, {
            requestParameters: {
                "method.request.querystring.fileName": true,
            },
            authorizer: bothAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
        });
        login.addMethod("POST", loginIntegration);
        register.addMethod("POST", registerIntegration);
        checkUsername.addMethod("GET", checkUsernameIntegration, {
            requestParameters: {
                "method.request.querystring.username": true,
            }
        });
        checkIfMovie.addMethod("GET", checkIfMovieIntegration, {
            requestParameters: {
                "method.request.querystring.title": true,
            },
            authorizer: adminAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
        });
        checkIfEpisodeExists.addMethod("GET", checkIfEpisodeExistsIntegration, {
            requestParameters: {
                "method.request.querystring.title": true,
                "method.request.querystring.episodeNumber": true,
                "method.request.querystring.seasonNumber": true,
            },
            authorizer: adminAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
        });
        downloadMetadataTvShow.addMethod("GET", downloadMetadataForTvShowIntegration, {
            requestParameters: {
                "method.request.querystring.title": true,
            },
            authorizer: bothAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
        });
        rate.addMethod("POST", rateMovieIntegration, { authorizer: userAuthorizer });
        movieRating.addMethod("GET", getMovieRatingIntegration, {
            requestParameters: {
                "method.request.querystring.movieId": true,
                "method.request.querystring.username": true,
            },
            authorizer: userAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
        });
        userRatings.addMethod("GET", getUserRatingsIntegration, {
            requestParameters: {
                "method.request.querystring.username": true,
            },
            authorizer: userAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
        });
        download.addMethod("POST", downloadHistoryIntegration, { authorizer: userAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM, });
        userHistory.addMethod("GET", getUserHistoryIntegration, {
            requestParameters: {
                "method.request.querystring.username": true,
            },
            authorizer: userAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
        });
        subscriptions.addMethod("GET", getSubscriptionsByUsernameIntegration, {
            requestParameters: {
                "method.request.querystring.username": true,
            },
            authorizer: userAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
        });
        generateFeed.addMethod("POST", generateFeedIntegration);
        generateFeedForAll.addMethod("POST", invokeIntegration);
        feed.addMethod("GET", getFeedIntegration, {
            requestParameters: {
                "method.request.querystring.username": true,
            },
            authorizer: bothAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
        });
    }
}
exports.Cloud2024Stack = Cloud2024Stack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xvdWQyMDI0LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2xvdWQyMDI0LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyxpREFBaUQ7QUFDakQseURBQXlEO0FBQ3pELHFEQUFxRDtBQUNyRCx5Q0FBeUM7QUFDekMsbURBQW1EO0FBQ25ELDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsMkVBQTJFO0FBRTNFLDZCQUE2QjtBQUk3QixNQUFhLGNBQWUsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN6QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzVELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUMzQyxJQUFJLEVBQ0oscUJBQXFCLEVBQ3JCO1lBQ0ksT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDO1lBQ2xDLE9BQU8sRUFBRSxxQkFBcUI7U0FDakMsQ0FDSixDQUFDO1FBRUYsTUFBTSxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDekQsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO1lBQzNCLGFBQWEsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUU7WUFDakMsY0FBYyxFQUFFO2dCQUNaLFNBQVMsRUFBRSxtQkFBbUI7YUFDakM7WUFDRCxnQkFBZ0IsRUFBRTtnQkFDZCxJQUFJLEVBQUUsSUFBSSxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUMsT0FBTyxFQUFFLElBQUksRUFBQyxDQUFDO2FBQ3JEO1NBQ0osQ0FBQyxDQUFD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QUFTLENBQUMsS0FBSyxFQUFFLGtCQUFrQixFQUFFO1lBQ3RDLGlCQUFpQixFQUFFO2dCQUNmLHFDQUFxQyxFQUFFLElBQUk7YUFDOUM7WUFDRCxVQUFVLEVBQUUsY0FBYztZQUMxQixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCLENBQUMsTUFBTTtTQUN6RCxDQUFDLENBQUM7SUFDUCxDQUFDO0NBQ0o7QUF2N0JELHdDQXU3QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYVwiO1xyXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheVwiO1xyXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiXCI7XHJcbmltcG9ydCAqIGFzIHMzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtczNcIjtcclxuaW1wb3J0ICogYXMgY29nbml0byBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWNvZ25pdG9cIjtcclxuaW1wb3J0ICogYXMgaWFtIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtaWFtXCI7XHJcbmltcG9ydCAqIGFzIHNxcyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXNxc1wiO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGFFdmVudFNvdXJjZXMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlc1wiO1xyXG5cclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xyXG5pbXBvcnQgeyBnZXQgfSBmcm9tIFwiaHR0cFwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIENsb3VkMjAyNFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgICAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICAgICAgY29uc3QgcHJlUmVnaXN0ZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwicHJlUmVnaXN0ZXJGdW5jdGlvblwiLFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInNyY1wiKSxcclxuICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwicHJlUmVnaXN0ZXIuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgdXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCBcIk1vdmllVXNlclBvb2xcIiwge1xyXG4gICAgICAgICAgICBzZWxmU2lnblVwRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICAgICAgYXV0b1ZlcmlmeTogeyBlbWFpbDogdHJ1ZSB9LFxyXG4gICAgICAgICAgICBzaWduSW5BbGlhc2VzOiB7IHVzZXJuYW1lOiB0cnVlIH0sXHJcbiAgICAgICAgICAgIGxhbWJkYVRyaWdnZXJzOiB7XHJcbiAgICAgICAgICAgICAgICBwcmVTaWduVXA6IHByZVJlZ2lzdGVyRnVuY3Rpb24sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGN1c3RvbUF0dHJpYnV0ZXM6IHtcclxuICAgICAgICAgICAgICAgIHJvbGU6IG5ldyBjb2duaXRvLlN0cmluZ0F0dHJpYnV0ZSh7bXV0YWJsZTogdHJ1ZX0pLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCB1c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KFxyXG4gICAgICAgICAgICB0aGlzLFxyXG4gICAgICAgICAgICBcIk1vdmllVXNlclBvb2xDbGllbnRcIixcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdXNlclBvb2wsXHJcbiAgICAgICAgICAgICAgICBhdXRoRmxvd3M6IHtcclxuICAgICAgICAgICAgICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuICAgIFxyXG4gICAgICAgIGNvbnN0IGF1dGhvcml6ZUFkbWluRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBdXRob3JpemVBZG1pbkZ1bmN0aW9uJywge1xyXG4gICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM184LFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnYWRtaW5BdXRob3JpemVyLmhhbmRsZXInLFxyXG4gICAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXHJcbiAgICAgICAgICAgICAgICBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL3NyYy9weXRob24tbGFtYmRhc1wiKSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBidW5kbGluZzoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpbWFnZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOC5idW5kbGluZ0ltYWdlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21tYW5kOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImJhc2hcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiLWNcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicGlwIGluc3RhbGwgLXIgcmVxdWlyZW1lbnRzLnR4dCAtdCAvYXNzZXQtb3V0cHV0ICYmIGNwIC1yIC4gL2Fzc2V0LW91dHB1dFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICksXHJcbiAgICAgICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICAgICAgICBVU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgICAgICAgICAgICBDTElFTlRfSUQ6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7XHJcbiAgICBcclxuICAgICAgICBjb25zdCBhdXRob3JpemVVc2VyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBdXRob3JpemVVc2VyRnVuY3Rpb24nLCB7XHJcbiAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzgsXHJcbiAgICAgICAgICAgIGhhbmRsZXI6ICd1c2VyQXV0aG9yaXplci5oYW5kbGVyJyxcclxuICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFxyXG4gICAgICAgICAgICAgICAgcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9zcmMvcHl0aG9uLWxhbWJkYXNcIiksXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaW1hZ2U6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzguYnVuZGxpbmdJbWFnZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29tbWFuZDogW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJiYXNoXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIi1jXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcInBpcCBpbnN0YWxsIC1yIHJlcXVpcmVtZW50cy50eHQgLXQgL2Fzc2V0LW91dHB1dCAmJiBjcCAtciAuIC9hc3NldC1vdXRwdXRcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICApLFxyXG4gICAgICAgICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgICAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICAgICAgICAgICAgQ0xJRU5UX0lEOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCBhdXRob3JpemVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0F1dGhvcml6ZUZ1bmN0aW9uJywge1xyXG4gICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM184LFxyXG4gICAgICAgICAgICBoYW5kbGVyOiAnYXV0aG9yaXplci5oYW5kbGVyJyxcclxuICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFxyXG4gICAgICAgICAgICAgICAgcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9zcmMvcHl0aG9uLWxhbWJkYXNcIiksXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaW1hZ2U6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzguYnVuZGxpbmdJbWFnZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29tbWFuZDogW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJiYXNoXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIi1jXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcInBpcCBpbnN0YWxsIC1yIHJlcXVpcmVtZW50cy50eHQgLXQgL2Fzc2V0LW91dHB1dCAmJiBjcCAtciAuIC9hc3NldC1vdXRwdXRcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICApLFxyXG4gICAgICAgICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgICAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICAgICAgICAgICAgQ0xJRU5UX0lEOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG4gICAgXHJcbiAgICAgICAgY29uc3QgYWRtaW5BdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXkuVG9rZW5BdXRob3JpemVyKHRoaXMsICdhZG1pbi1hdXRob3JpemVyJywge1xyXG4gICAgICAgICAgICBoYW5kbGVyOiBhdXRob3JpemVBZG1pbkZ1bmN0aW9uLFxyXG4gICAgICAgICAgICByZXN1bHRzQ2FjaGVUdGw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDApXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IHVzZXJBdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXkuVG9rZW5BdXRob3JpemVyKHRoaXMsICd1c2VyLWF1dGhvcml6ZXInLCB7XHJcbiAgICAgICAgICAgIGhhbmRsZXI6IGF1dGhvcml6ZVVzZXJGdW5jdGlvbixcclxuICAgICAgICAgICAgcmVzdWx0c0NhY2hlVHRsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygwKVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCBib3RoQXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LlRva2VuQXV0aG9yaXplcih0aGlzLCAnYm90aC1hdXRob3JpemVyJywge1xyXG4gICAgICAgICAgICBoYW5kbGVyOiBhdXRob3JpemVGdW5jdGlvbixcclxuICAgICAgICAgICAgcmVzdWx0c0NhY2hlVHRsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygwKVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCBidWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsIFwiTW92aWVCdWNrZXRcIiwge1xyXG4gICAgICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCBoZWxwZXJCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsIFwiVHJhbnNjb2RpbmdCdWNrZXRcIiwge1xyXG4gICAgICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBidWNrZXQuYWRkTGlmZWN5Y2xlUnVsZSh7XHJcbiAgICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDEpLCAvLyBFeHBpcmUgb2JqZWN0c1xyXG4gICAgICAgICAgICBhYm9ydEluY29tcGxldGVNdWx0aXBhcnRVcGxvYWRBZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMSksIC8vIEFib3J0IGluY29tcGxldGUgdXBsb2Fkc1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCB0YWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIk1vdmllVGFibGVcIiwge1xyXG4gICAgICAgICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJpZFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCByYXRpbmdzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJSYXRpbmdzVGFibGVcIiwge1xyXG4gICAgICAgICAgICBwYXJ0aXRpb25LZXk6IHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IFwicmF0aW5nSWRcIixcclxuICAgICAgICAgICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCBoaXN0b3J5VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJEb3dubG9hZEhpc3RvcnlUYWJsZVwiLCB7XHJcbiAgICAgICAgICAgIHBhcnRpdGlvbktleToge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJkb3dubG9hZElkXCIsXHJcbiAgICAgICAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgICB9KTtcclxuICAgICAgICBjb25zdCBzdWJzY3JpcHRpb25zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUoXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwiU3Vic2NyaXB0aW9uc1RhYmxlXCIsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHBhcnRpdGlvbktleToge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IFwidXNlcklkXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgICAgICAgICAgIHRhYmxlTmFtZTogXCJTdWJzY3JpcHRpb25zVGFibGVcIixcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIGNvbnN0IGZlZWRUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIkZlZWRUYWJsZVwiLCB7XHJcbiAgICAgICAgICAgIHBhcnRpdGlvbktleToge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJ1c2VybmFtZVwiLFxyXG4gICAgICAgICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IG5vdGlmaWNhdGlvbnNRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgXCJOb3RpZmljYXRpb25RdWV1ZVwiLCB7XHJcbiAgICAgICAgICAgIHZpc2liaWxpdHlUaW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMDApLFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCB0cmFuc2NvZGluZ1F1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCBcIlRyYW5zY29kaW5nUXVldWVcIiwge1xyXG4gICAgICAgICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNTAwKSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgY29uc3QgZmVlZFF1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCBcIkZlZWRRdWV1ZVwiLCB7XHJcbiAgICAgICAgICAgIHZpc2liaWxpdHlUaW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg1MDApLFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBBZGRpbmcgYSBHbG9iYWwgU2Vjb25kYXJ5IEluZGV4IChHU0kpIGZvciBmaWxlTmFtZVxyXG4gICAgICAgIHRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgICAgICAgaW5kZXhOYW1lOiBcIkZpbGVOYW1lSW5kZXhcIixcclxuICAgICAgICAgICAgcGFydGl0aW9uS2V5OiB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBcImZpbGVOYW1lXCIsXHJcbiAgICAgICAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICAgICAgICBpbmRleE5hbWU6IFwiQ29tYmluZWRJbmRleFwiLFxyXG4gICAgICAgICAgICBwYXJ0aXRpb25LZXk6IHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IFwiY29tYmluZWRLZXlcIixcclxuICAgICAgICAgICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBHU0kgZm9yIG1vdmllIGlkXHJcbiAgICAgICAgcmF0aW5nc1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgICAgICAgaW5kZXhOYW1lOiBcIk1vdmllUmF0ZUluZGV4XCIsXHJcbiAgICAgICAgICAgIHBhcnRpdGlvbktleToge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJtb3ZpZUlkXCIsXHJcbiAgICAgICAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgc29ydEtleToge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJ1c2VybmFtZVwiLFxyXG4gICAgICAgICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJhdGluZ3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgICAgICAgIGluZGV4TmFtZTogXCJVc2VybmFtZUluZGV4XCIsXHJcbiAgICAgICAgICAgIHBhcnRpdGlvbktleToge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogXCJ1c2VybmFtZVwiLFxyXG4gICAgICAgICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHN1YnNjcmlwdGlvbnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgICAgICAgIGluZGV4TmFtZTogXCJVc2VybmFtZVN1YnNjcmlwdGlvbnNJbmRleFwiLFxyXG4gICAgICAgICAgICBwYXJ0aXRpb25LZXk6IHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IFwidXNlcm5hbWVcIixcclxuICAgICAgICAgICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBoaXN0b3J5VGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICAgICAgICBpbmRleE5hbWU6IFwiVXNlcm5hbWVIaXN0b3J5SW5kZXhcIixcclxuICAgICAgICAgICAgcGFydGl0aW9uS2V5OiB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBcInVzZXJuYW1lXCIsXHJcbiAgICAgICAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgY29uc3QgbG9naW5GdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJsb2dpbkZ1bmN0aW9uXCIsIHtcclxuICAgICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInNyY1wiKSxcclxuICAgICAgICAgICAgaGFuZGxlcjogXCJsb2dpbi5oYW5kbGVyXCIsXHJcbiAgICAgICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICAgICAgICBDT0dOSVRPX0NMSUVOVF9JRDogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgICAgICAgICAgICAgIENPR05JVE9fVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCByZWdpc3RlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcInJlZ2lzdGVyRnVuY3Rpb25cIiwge1xyXG4gICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwic3JjXCIpLFxyXG4gICAgICAgICAgICBoYW5kbGVyOiBcInJlZ2lzdGVyLmhhbmRsZXJcIixcclxuICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgIENPR05JVE9fQ0xJRU5UX0lEOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxyXG4gICAgICAgICAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGNoZWNrVXNlcm5hbWVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwiY2hlY2tVc2VybmFtZUZ1bmN0aW9uXCIsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwic3JjXCIpLFxyXG4gICAgICAgICAgICAgICAgaGFuZGxlcjogXCJjaGVja1VzZXJuYW1lLmhhbmRsZXJcIixcclxuICAgICAgICAgICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgQ09HTklUT19DTElFTlRfSUQ6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXHJcbiAgICAgICAgICAgICAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgYWRtaW5HZXRVc2VyUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgICBhY3Rpb25zOiBbXCJjb2duaXRvLWlkcDpBZG1pbkdldFVzZXJcIl0sXHJcbiAgICAgICAgICAgIHJlc291cmNlczogW3VzZXJQb29sLnVzZXJQb29sQXJuXSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgY2hlY2tVc2VybmFtZUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShhZG1pbkdldFVzZXJQb2xpY3kpO1xyXG5cclxuICAgICAgICAvLyBBZGRpbmcgYSBHbG9iYWwgU2Vjb25kYXJ5IEluZGV4IChHU0kpIGZvciB0aXRsZVxyXG4gICAgICAgIHRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgICAgICAgaW5kZXhOYW1lOiBcIlRpdGxlSW5kZXhcIixcclxuICAgICAgICAgICAgcGFydGl0aW9uS2V5OiB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBcInRpdGxlXCIsXHJcbiAgICAgICAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgY29uc3QgdXBsb2FkTWV0YWRhdGFGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwidXBsb2FkTWV0YWRhdGFGdW5jdGlvblwiLFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInNyY1wiKSxcclxuICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwidXBsb2FkTWV0YWRhdGEuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBUQUJMRV9OQU1FOiB0YWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgU1FTX1FVRVVFX1VSTDogbm90aWZpY2F0aW9uc1F1ZXVlLnF1ZXVlVXJsLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIGNvbnN0IGRvd25sb2FkTW92aWVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwiZG93bmxvYWRNb3ZpZUZ1bmN0aW9uXCIsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwic3JjXCIpLFxyXG4gICAgICAgICAgICAgICAgaGFuZGxlcjogXCJkb3dubG9hZE1vdmllLmhhbmRsZXJcIixcclxuICAgICAgICAgICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgQlVDS0VUX05BTUU6IGJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIGNvbnN0IGRvd25sb2FkTWV0YWRhdGFGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwiZG93bmxvYWRNZXRhZGF0YUZ1bmN0aW9uXCIsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwic3JjXCIpLFxyXG4gICAgICAgICAgICAgICAgaGFuZGxlcjogXCJkb3dubG9hZE1ldGFkYXRhLmhhbmRsZXJcIixcclxuICAgICAgICAgICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgVEFCTEVfTkFNRTogdGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIGNvbnN0IHVwZGF0ZU1ldGFkYXRhRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxyXG4gICAgICAgICAgICB0aGlzLFxyXG4gICAgICAgICAgICBcInVwZGF0ZU1ldGFkYXRhRnVuY3Rpb25cIixcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgICAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJzcmNcIiksXHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyOiBcInVwZGF0ZU1ldGFkYXRhLmhhbmRsZXJcIixcclxuICAgICAgICAgICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgVEFCTEVfTkFNRTogdGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgIFNRU19RVUVVRV9VUkw6IG5vdGlmaWNhdGlvbnNRdWV1ZS5xdWV1ZVVybCxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBjb25zdCB0cmFuc2NvZGluZ0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwidHJhbnNjb2RpbmdMYW1iZGFcIixcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOCxcclxuICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwidHJhbnNjb2RpbmdMYW1iZGEuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFxyXG4gICAgICAgICAgICAgICAgICAgIHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vc3JjL3B5dGhvbi1sYW1iZGFzXCIpLFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGltYWdlOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM184LmJ1bmRsaW5nSW1hZ2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21tYW5kOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJiYXNoXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCItY1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicGlwIGluc3RhbGwgLXIgcmVxdWlyZW1lbnRzLnR4dCAtdCAvYXNzZXQtb3V0cHV0ICYmIGNwIC1yIC4gL2Fzc2V0LW91dHB1dFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICApLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBQQVRIOiBcIi92YXIvdGFzay9iaW5cIixcclxuICAgICAgICAgICAgICAgICAgICBCVUNLRVRfTkFNRTogYnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgSEVMUEVSX0JVQ0tFVF9OQU1FOiBoZWxwZXJCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgICAgICAgICAgICAgICBTUVNfUVVFVUVfVVJMOiB0cmFuc2NvZGluZ1F1ZXVlLnF1ZXVlVXJsLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcclxuICAgICAgICAgICAgICAgIG1lbW9yeVNpemU6IDEwMjQsXHJcbiAgICAgICAgICAgICAgICBlcGhlbWVyYWxTdG9yYWdlU2l6ZTogY2RrLlNpemUubWViaWJ5dGVzKDEwMjQpLFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdHJhbnNjb2RpbmdMYW1iZGEuYWRkRXZlbnRTb3VyY2UoXHJcbiAgICAgICAgICAgIG5ldyBsYW1iZGFFdmVudFNvdXJjZXMuU3FzRXZlbnRTb3VyY2UodHJhbnNjb2RpbmdRdWV1ZSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBjb25zdCB1cGxvYWRNb3ZpZUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcclxuICAgICAgICAgICAgdGhpcyxcclxuICAgICAgICAgICAgXCJ1cGxvYWRNb3ZpZUZ1bmN0aW9uXCIsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzgsXHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyOiBcInVwbG9hZE1vdmllLmhhbmRsZXJcIixcclxuICAgICAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcclxuICAgICAgICAgICAgICAgICAgICBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL3NyYy9weXRob24tbGFtYmRhc1wiKVxyXG4gICAgICAgICAgICAgICAgKSxcclxuICAgICAgICAgICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgUEFUSDogXCIvdmFyL3Rhc2svYmluXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgU1FTX1FVRVVFX1VSTDogdHJhbnNjb2RpbmdRdWV1ZS5xdWV1ZVVybCxcclxuICAgICAgICAgICAgICAgICAgICBIRUxQRVJfQlVDS0VUX05BTUU6IGhlbHBlckJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcclxuICAgICAgICAgICAgICAgIG1lbW9yeVNpemU6IDEwMjQsXHJcbiAgICAgICAgICAgICAgICBlcGhlbWVyYWxTdG9yYWdlU2l6ZTogY2RrLlNpemUubWViaWJ5dGVzKDEwMjQpLFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgZG93bmxvYWRNZXRhZGF0YUJ5RmlsZU5hbWVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwiZG93bmxvYWRNZXRhZGF0YUJ5RmlsZU5hbWVGdW5jdGlvblwiLFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInNyY1wiKSxcclxuICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwiZG93bmxvYWRNZXRhZGF0YUJ5RmlsZU5hbWUuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBUQUJMRV9OQU1FOiB0YWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgY2hlY2tJZk1vdmllRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxyXG4gICAgICAgICAgICB0aGlzLFxyXG4gICAgICAgICAgICBcImNoZWNrSWZNb3ZpZUZ1bmN0aW9uXCIsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwic3JjXCIpLFxyXG4gICAgICAgICAgICAgICAgaGFuZGxlcjogXCJjaGVja0lmTW92aWUuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBUQUJMRV9OQU1FOiB0YWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgY2hlY2tJZkVwaXNvZGVFeGlzdHNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwiY2hlY2tJZkVwaXNvZGVFeGlzdHNGdW5jdGlvblwiLFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInNyY1wiKSxcclxuICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwiY2hlY2tJZkVwaXNvZGVFeGlzdHMuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBUQUJMRV9OQU1FOiB0YWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgZG93bmxvYWRNZXRhZGF0YUZvclR2U2hvd0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcclxuICAgICAgICAgICAgdGhpcyxcclxuICAgICAgICAgICAgXCJkb3dubG9hZE1ldGFkYXRhRm9yVHZTaG93RnVuY3Rpb25cIixcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgICAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJzcmNcIiksXHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyOiBcImRvd25sb2FkTWV0YWRhdGFGb3JUdlNob3cuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBUQUJMRV9OQU1FOiB0YWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgZGVsZXRlTWV0YWRhdGFGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwiZGVsZXRlTWV0YWRhdGFGdW5jdGlvblwiLFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInNyY1wiKSxcclxuICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwiZGVsZXRlTWV0YWRhdGEuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBUQUJMRV9OQU1FOiB0YWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgdXBkYXRlTW92aWVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwidXBkYXRlTW92aWVGdW5jdGlvblwiLFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInNyY1wiKSxcclxuICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwidXBkYXRlTW92aWUuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBCVUNLRVRfTkFNRTogYnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgZGVsZXRlTW92aWVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwiZGVsZXRlTW92aWVGdW5jdGlvblwiLFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInNyY1wiKSxcclxuICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwiZGVsZXRlTW92aWUuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBCVUNLRVRfTkFNRTogYnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgcmF0ZU1vdmllRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxyXG4gICAgICAgICAgICB0aGlzLFxyXG4gICAgICAgICAgICBcInJhdGVNb3ZpZUZ1bmN0aW9uXCIsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwic3JjXCIpLFxyXG4gICAgICAgICAgICAgICAgaGFuZGxlcjogXCJyYXRlTW92aWUuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBUQUJMRV9OQU1FOiByYXRpbmdzVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIGNvbnN0IGdldE1vdmllUmF0aW5nRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxyXG4gICAgICAgICAgICB0aGlzLFxyXG4gICAgICAgICAgICBcImdldE1vdmllUmF0aW5nRnVuY3Rpb25cIixcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgICAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJzcmNcIiksXHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyOiBcImdldE1vdmllUmF0aW5nLmhhbmRsZXJcIixcclxuICAgICAgICAgICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgVEFCTEVfTkFNRTogcmF0aW5nc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBjb25zdCBnZXRVc2VyUmF0aW5nc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcclxuICAgICAgICAgICAgdGhpcyxcclxuICAgICAgICAgICAgXCJnZXRVc2VyUmF0aW5nc0Z1bmN0aW9uXCIsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwic3JjXCIpLFxyXG4gICAgICAgICAgICAgICAgaGFuZGxlcjogXCJnZXRVc2VyUmF0aW5ncy5oYW5kbGVyXCIsXHJcbiAgICAgICAgICAgICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgICAgICAgICAgICAgIFRBQkxFX05BTUU6IHJhdGluZ3NUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgZG93bmxvYWRIaXN0b3J5RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxyXG4gICAgICAgICAgICB0aGlzLFxyXG4gICAgICAgICAgICBcImRvd25sb2FkSGlzdG9yeUZ1bmN0aW9uXCIsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwic3JjXCIpLFxyXG4gICAgICAgICAgICAgICAgaGFuZGxlcjogXCJkb3dubG9hZEhpc3RvcnkuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBUQUJMRV9OQU1FOiBoaXN0b3J5VGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIGNvbnN0IGdldFVzZXJIaXN0b3J5RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxyXG4gICAgICAgICAgICB0aGlzLFxyXG4gICAgICAgICAgICBcImdldFVzZXJEb3dubG9hZEhpc3RvcnlGdW5jdGlvblwiLFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInNyY1wiKSxcclxuICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwiZ2V0RG93bmxvYWRIaXN0b3J5LmhhbmRsZXJcIixcclxuICAgICAgICAgICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgVEFCTEVfTkFNRTogaGlzdG9yeVRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBjb25zdCBzdWJzY3JpYmVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24oXHJcbiAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgIFwic3Vic2NyaWJlRnVuY3Rpb25cIixcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgICAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJzcmNcIiksXHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyOiBcInN1YnNjcmliZS5oYW5kbGVyXCIsXHJcbiAgICAgICAgICAgICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgICAgICAgICAgICAgIFNVQlNDUklQVElPTlNfVEFCTEVfTkFNRTogc3Vic2NyaXB0aW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBjb25zdCBnZXRTdWJzY3JpcHRpb25zRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxyXG4gICAgICAgICAgICB0aGlzLFxyXG4gICAgICAgICAgICBcImdldFN1YnNjcmlwdGlvbnNGdW5jdGlvblwiLFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInNyY1wiKSxcclxuICAgICAgICAgICAgICAgIGhhbmRsZXI6IFwiZ2V0U3Vic2NyaXB0aW9ucy5oYW5kbGVyXCIsXHJcbiAgICAgICAgICAgICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgICAgICAgICAgICAgIFNVQlNDUklQVElPTlNfVEFCTEVfTkFNRTogc3Vic2NyaXB0aW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBjb25zdCBnZXRTdWJzY3JpcHRpb25zQnlVc2VybmFtZUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcclxuICAgICAgICAgICAgdGhpcyxcclxuICAgICAgICAgICAgXCJnZXRTdWJzY3JpcHRpb25zQnlVc2VybmFtZUZ1bmN0aW9uXCIsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwic3JjXCIpLFxyXG4gICAgICAgICAgICAgICAgaGFuZGxlcjogXCJnZXRTdWJzY3JpcHRpb25zQnlVc2VybmFtZS5oYW5kbGVyXCIsXHJcbiAgICAgICAgICAgICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgICAgICAgICAgICAgIFRBQkxFX05BTUU6IHN1YnNjcmlwdGlvbnNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3Qgc2VuZE5vdGlmaWNhdGlvbkZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbihcclxuICAgICAgICAgICAgdGhpcyxcclxuICAgICAgICAgICAgXCJzZW5kTm90aWZpY2F0aW9uRnVuY3Rpb25cIixcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgICAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJzcmNcIiksXHJcbiAgICAgICAgICAgICAgICBoYW5kbGVyOiBcInNlbmROb3RpZmljYXRpb24uaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBTVUJTQ1JJUFRJT05TX1RBQkxFX05BTUU6IHN1YnNjcmlwdGlvbnNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgY29uc3QgZ2VuZXJhdGVGZWVkRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKFxyXG4gICAgICAgICAgICB0aGlzLFxyXG4gICAgICAgICAgICBcImdlbmVyYXRlRmVlZEZ1bmN0aW9uXCIsXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwic3JjXCIpLFxyXG4gICAgICAgICAgICAgICAgaGFuZGxlcjogXCJnZW5lcmF0ZUZlZWQuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgICAgICBGRUVEX1RBQkxFX05BTUU6IGZlZWRUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgTV9UQUJMRV9OQU1FOiB0YWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgU19UQUJMRV9OQU1FOiBzdWJzY3JpcHRpb25zVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgIERIX1RBQkxFX05BTUU6IGhpc3RvcnlUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgVVJfVEFCTEVfTkFNRTogcmF0aW5nc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBjb25zdCBnZXRGZWVkRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiZ2V0RmVlZEZ1bmN0aW9uXCIsIHtcclxuICAgICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInNyY1wiKSxcclxuICAgICAgICAgICAgaGFuZGxlcjogXCJnZXRGZWVkLmhhbmRsZXJcIixcclxuICAgICAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgIFRBQkxFX05BTUU6IGZlZWRUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGludm9rZUxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJJbnZva2VGZWVkRnVuY3Rpb25cIiwge1xyXG4gICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgICAgICAgaGFuZGxlcjogXCJnZW5lcmF0ZUZlZWRGb3JBbGwuaGFuZGxlclwiLFxyXG4gICAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJzcmNcIiksXHJcbiAgICAgICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICAgICAgICBGRUVEX1RBQkxFX05BTUU6IGZlZWRUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IHNlYXJjaEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcInNlYXJjaEZ1bmN0aW9uXCIsIHtcclxuICAgICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcInNyY1wiKSxcclxuICAgICAgICAgICAgaGFuZGxlcjogXCJzZWFyY2guaGFuZGxlclwiLFxyXG4gICAgICAgICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgICAgICAgICAgVEFCTEVfTkFNRTogdGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBzZW5kTm90aWZpY2F0aW9uRnVuY3Rpb24uYWRkRXZlbnRTb3VyY2UoXHJcbiAgICAgICAgICAgIG5ldyBsYW1iZGFFdmVudFNvdXJjZXMuU3FzRXZlbnRTb3VyY2Uobm90aWZpY2F0aW9uc1F1ZXVlLCB7XHJcbiAgICAgICAgICAgICAgICBiYXRjaFNpemU6IDEwLCAvLyBOdW1iZXIgb2YgbWVzc2FnZXMgdG8gcHJvY2VzcyBwZXIgaW52b2NhdGlvblxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh1cGxvYWRNZXRhZGF0YUZ1bmN0aW9uKTtcclxuICAgICAgICB0YWJsZS5ncmFudFJlYWRXcml0ZURhdGEodXBkYXRlTWV0YWRhdGFGdW5jdGlvbik7XHJcbiAgICAgICAgdGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGRlbGV0ZU1ldGFkYXRhRnVuY3Rpb24pO1xyXG4gICAgICAgIHRhYmxlLmdyYW50UmVhZERhdGEoZG93bmxvYWRNZXRhZGF0YUZ1bmN0aW9uKTtcclxuICAgICAgICB0YWJsZS5ncmFudFJlYWREYXRhKGRvd25sb2FkTWV0YWRhdGFGdW5jdGlvbik7XHJcbiAgICAgICAgdGFibGUuZ3JhbnRSZWFkRGF0YShjaGVja0lmTW92aWVGdW5jdGlvbik7XHJcbiAgICAgICAgdGFibGUuZ3JhbnRSZWFkRGF0YShjaGVja0lmRXBpc29kZUV4aXN0c0Z1bmN0aW9uKTtcclxuICAgICAgICB0YWJsZS5ncmFudFJlYWREYXRhKGRvd25sb2FkTWV0YWRhdGFGb3JUdlNob3dGdW5jdGlvbik7XHJcbiAgICAgICAgdGFibGUuZ3JhbnRSZWFkRGF0YShnZW5lcmF0ZUZlZWRGdW5jdGlvbik7XHJcbiAgICAgICAgdGFibGUuZ3JhbnRSZWFkRGF0YShzZWFyY2hGdW5jdGlvbik7XHJcbiAgICAgICAgYnVja2V0LmdyYW50UmVhZFdyaXRlKHVwbG9hZE1vdmllRnVuY3Rpb24pO1xyXG4gICAgICAgIGJ1Y2tldC5ncmFudFJlYWQoZG93bmxvYWRNb3ZpZUZ1bmN0aW9uKTtcclxuICAgICAgICBidWNrZXQuZ3JhbnRSZWFkV3JpdGUodXBkYXRlTW92aWVGdW5jdGlvbik7XHJcbiAgICAgICAgYnVja2V0LmdyYW50UmVhZFdyaXRlKGRlbGV0ZU1vdmllRnVuY3Rpb24pO1xyXG4gICAgICAgIHRhYmxlLmdyYW50UmVhZERhdGEoZG93bmxvYWRNZXRhZGF0YUJ5RmlsZU5hbWVGdW5jdGlvbik7XHJcblxyXG4gICAgICAgIHJhdGluZ3NUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEocmF0ZU1vdmllRnVuY3Rpb24pO1xyXG4gICAgICAgIHJhdGluZ3NUYWJsZS5ncmFudFJlYWREYXRhKGdldE1vdmllUmF0aW5nRnVuY3Rpb24pO1xyXG4gICAgICAgIHJhdGluZ3NUYWJsZS5ncmFudFJlYWREYXRhKGdldFVzZXJSYXRpbmdzRnVuY3Rpb24pO1xyXG4gICAgICAgIHJhdGluZ3NUYWJsZS5ncmFudFJlYWREYXRhKGdlbmVyYXRlRmVlZEZ1bmN0aW9uKTtcclxuXHJcbiAgICAgICAgc3Vic2NyaXB0aW9uc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzdWJzY3JpYmVGdW5jdGlvbik7XHJcbiAgICAgICAgc3Vic2NyaXB0aW9uc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzZW5kTm90aWZpY2F0aW9uRnVuY3Rpb24pO1xyXG4gICAgICAgIHN1YnNjcmlwdGlvbnNUYWJsZS5ncmFudFJlYWREYXRhKGdldFN1YnNjcmlwdGlvbnNGdW5jdGlvbik7XHJcbiAgICAgICAgc3Vic2NyaXB0aW9uc1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0U3Vic2NyaXB0aW9uc0J5VXNlcm5hbWVGdW5jdGlvbik7XHJcbiAgICAgICAgc3Vic2NyaXB0aW9uc1RhYmxlLmdyYW50UmVhZERhdGEoZ2VuZXJhdGVGZWVkRnVuY3Rpb24pO1xyXG4gICAgICAgIG5vdGlmaWNhdGlvbnNRdWV1ZS5ncmFudFNlbmRNZXNzYWdlcyh1cGxvYWRNZXRhZGF0YUZ1bmN0aW9uKTtcclxuICAgICAgICBub3RpZmljYXRpb25zUXVldWUuZ3JhbnRTZW5kTWVzc2FnZXModXBkYXRlTWV0YWRhdGFGdW5jdGlvbik7XHJcbiAgICAgICAgbm90aWZpY2F0aW9uc1F1ZXVlLmdyYW50Q29uc3VtZU1lc3NhZ2VzKHNlbmROb3RpZmljYXRpb25GdW5jdGlvbik7XHJcblxyXG4gICAgICAgIHRyYW5zY29kaW5nUXVldWUuZ3JhbnRDb25zdW1lTWVzc2FnZXModHJhbnNjb2RpbmdMYW1iZGEpO1xyXG4gICAgICAgIHRyYW5zY29kaW5nUXVldWUuZ3JhbnRTZW5kTWVzc2FnZXModXBsb2FkTW92aWVGdW5jdGlvbik7XHJcbiAgICAgICAgaGVscGVyQnVja2V0LmdyYW50V3JpdGUodXBsb2FkTW92aWVGdW5jdGlvbik7XHJcbiAgICAgICAgaGVscGVyQnVja2V0LmdyYW50UmVhZCh0cmFuc2NvZGluZ0xhbWJkYSk7XHJcblxyXG4gICAgICAgIGhpc3RvcnlUYWJsZS5ncmFudFJlYWREYXRhKGdldFVzZXJIaXN0b3J5RnVuY3Rpb24pO1xyXG4gICAgICAgIGhpc3RvcnlUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZG93bmxvYWRIaXN0b3J5RnVuY3Rpb24pO1xyXG4gICAgICAgIGhpc3RvcnlUYWJsZS5ncmFudFJlYWREYXRhKGdlbmVyYXRlRmVlZEZ1bmN0aW9uKTtcclxuXHJcbiAgICAgICAgZmVlZFRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShnZW5lcmF0ZUZlZWRGdW5jdGlvbik7XHJcbiAgICAgICAgZmVlZFRhYmxlLmdyYW50UmVhZERhdGEoZ2V0RmVlZEZ1bmN0aW9uKTtcclxuICAgICAgICBmZWVkVGFibGUuZ3JhbnRSZWFkRGF0YShpbnZva2VMYW1iZGEpO1xyXG5cclxuICAgICAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsIFwiTW92aWVBcGlcIiwge1xyXG4gICAgICAgICAgICByZXN0QXBpTmFtZTogXCJNb3ZpZSBTZXJ2aWNlXCIsXHJcbiAgICAgICAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXHJcbiAgICAgICAgICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcclxuICAgICAgICAgICAgICAgIGFsbG93SGVhZGVyczogW1wiKlwiXSxcclxuICAgICAgICAgICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGxvZ2luSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcclxuICAgICAgICAgICAgbG9naW5GdW5jdGlvblxyXG4gICAgICAgICk7XHJcbiAgICAgICAgY29uc3QgcmVnaXN0ZXJJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxyXG4gICAgICAgICAgICByZWdpc3RlckZ1bmN0aW9uXHJcbiAgICAgICAgKTtcclxuICAgICAgICBjb25zdCBjaGVja1VzZXJuYW1lSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcclxuICAgICAgICAgICAgY2hlY2tVc2VybmFtZUZ1bmN0aW9uXHJcbiAgICAgICAgKTtcclxuICAgICAgICBjb25zdCB1cGxvYWRNZXRhZGF0YUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICAgIHVwbG9hZE1ldGFkYXRhRnVuY3Rpb25cclxuICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IGRvd25sb2FkTW92aWVJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxyXG4gICAgICAgICAgICBkb3dubG9hZE1vdmllRnVuY3Rpb25cclxuICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IGRvd25sb2FkTWV0YWRhdGFJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxyXG4gICAgICAgICAgICBkb3dubG9hZE1ldGFkYXRhRnVuY3Rpb25cclxuICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IHVwZGF0ZU1ldGFkYXRhSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcclxuICAgICAgICAgICAgdXBkYXRlTWV0YWRhdGFGdW5jdGlvblxyXG4gICAgICAgICk7XHJcbiAgICAgICAgY29uc3QgZGVsZXRlTWV0YWRhdGFJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxyXG4gICAgICAgICAgICBkZWxldGVNZXRhZGF0YUZ1bmN0aW9uXHJcbiAgICAgICAgKTtcclxuICAgICAgICBjb25zdCB1cGRhdGVNb3ZpZUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICAgIHVwZGF0ZU1vdmllRnVuY3Rpb25cclxuICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IGRlbGV0ZU1vdmllSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcclxuICAgICAgICAgICAgZGVsZXRlTW92aWVGdW5jdGlvblxyXG4gICAgICAgICk7XHJcbiAgICAgICAgY29uc3QgZG93bmxvYWRNZXRhZGF0YUJ5RmlsZU5hbWVJbnRlZ3JhdGlvbiA9XHJcbiAgICAgICAgICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxyXG4gICAgICAgICAgICAgICAgZG93bmxvYWRNZXRhZGF0YUJ5RmlsZU5hbWVGdW5jdGlvblxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IGNoZWNrSWZNb3ZpZUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICAgIGNoZWNrSWZNb3ZpZUZ1bmN0aW9uXHJcbiAgICAgICAgKTtcclxuICAgICAgICBjb25zdCBjaGVja0lmRXBpc29kZUV4aXN0c0ludGVncmF0aW9uID1cclxuICAgICAgICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oY2hlY2tJZkVwaXNvZGVFeGlzdHNGdW5jdGlvbik7XHJcbiAgICAgICAgY29uc3QgZG93bmxvYWRNZXRhZGF0YUZvclR2U2hvd0ludGVncmF0aW9uID1cclxuICAgICAgICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZG93bmxvYWRNZXRhZGF0YUZvclR2U2hvd0Z1bmN0aW9uKTtcclxuICAgICAgICBjb25zdCByYXRlTW92aWVJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxyXG4gICAgICAgICAgICByYXRlTW92aWVGdW5jdGlvblxyXG4gICAgICAgICk7XHJcbiAgICAgICAgY29uc3QgZ2V0TW92aWVSYXRpbmdJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxyXG4gICAgICAgICAgICBnZXRNb3ZpZVJhdGluZ0Z1bmN0aW9uXHJcbiAgICAgICAgKTtcclxuICAgICAgICBjb25zdCBnZXRVc2VyUmF0aW5nc0ludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICAgIGdldFVzZXJSYXRpbmdzRnVuY3Rpb25cclxuICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IGRvd25sb2FkSGlzdG9yeUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICAgIGRvd25sb2FkSGlzdG9yeUZ1bmN0aW9uXHJcbiAgICAgICAgKTtcclxuICAgICAgICBjb25zdCBnZXRVc2VySGlzdG9yeUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICAgIGdldFVzZXJIaXN0b3J5RnVuY3Rpb25cclxuICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IHN1YnNjcmliZUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICAgIHN1YnNjcmliZUZ1bmN0aW9uXHJcbiAgICAgICAgKTtcclxuICAgICAgICBjb25zdCBnZXRTdWJzY3JpcHRpb25zSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcclxuICAgICAgICAgICAgZ2V0U3Vic2NyaXB0aW9uc0Z1bmN0aW9uXHJcbiAgICAgICAgKTtcclxuICAgICAgICBjb25zdCBnZXRTdWJzY3JpcHRpb25zQnlVc2VybmFtZUludGVncmF0aW9uID1cclxuICAgICAgICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICAgICAgICBnZXRTdWJzY3JpcHRpb25zQnlVc2VybmFtZUZ1bmN0aW9uXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgY29uc3Qgc2VuZE5vdGlmaWNhdGlvbkludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICAgIHNlbmROb3RpZmljYXRpb25GdW5jdGlvblxyXG4gICAgICAgICk7XHJcbiAgICAgICAgY29uc3QgZ2VuZXJhdGVGZWVkSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcclxuICAgICAgICAgICAgZ2VuZXJhdGVGZWVkRnVuY3Rpb25cclxuICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IGdldEZlZWRJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxyXG4gICAgICAgICAgICBnZXRGZWVkRnVuY3Rpb25cclxuICAgICAgICApO1xyXG4gICAgICAgIGNvbnN0IGludm9rZUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICAgIGludm9rZUxhbWJkYVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgY29uc3Qgc2VhcmNoSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcclxuICAgICAgICAgICAgc2VhcmNoRnVuY3Rpb25cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICAvL3RyYW5zY29kaW5nXHJcbiAgICAgICAgYnVja2V0LmdyYW50UmVhZFdyaXRlKHRyYW5zY29kaW5nTGFtYmRhKTtcclxuICAgICAgICAvKmNvbnN0IHRyYW5zY29kaW5nSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihcclxuICAgICAgICAgICAgdHJhbnNjb2RpbmdMYW1iZGFcclxuICAgICAgICApOyovXHJcbiAgICAgICAgY29uc3QgdXBsb2FkTW92aWVJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKFxyXG4gICAgICAgICAgICB1cGxvYWRNb3ZpZUZ1bmN0aW9uXHJcbiAgICAgICAgKTtcclxuICAgICAgICBjb25zdCB0cmFuc2NvZGluZyA9IGFwaS5yb290LmFkZFJlc291cmNlKFwidHJhbnNjb2RpbmdcIik7XHJcbiAgICAgICAgY29uc3QgdHJhbnNjb2RlID0gdHJhbnNjb2RpbmcuYWRkUmVzb3VyY2UoXCJ0cmFuc2NvZGVcIik7XHJcbiAgICAgICAgdHJhbnNjb2RlLmFkZE1ldGhvZChcIlBPU1RcIiwgdXBsb2FkTW92aWVJbnRlZ3JhdGlvbik7XHJcblxyXG4gICAgICAgIGNvbnN0IG1vdmllcyA9IGFwaS5yb290LmFkZFJlc291cmNlKFwibW92aWVzXCIpO1xyXG4gICAgICAgIGNvbnN0IG1vdmllc01ldGFkYXRhID0gbW92aWVzLmFkZFJlc291cmNlKFwibWV0YWRhdGFcIik7XHJcbiAgICAgICAgY29uc3QgbW92aWVzVmlkZW8gPSBtb3ZpZXMuYWRkUmVzb3VyY2UoXCJ2aWRlb1wiKTtcclxuICAgICAgICBjb25zdCBsb2dpbiA9IGFwaS5yb290LmFkZFJlc291cmNlKFwibG9naW5cIik7XHJcbiAgICAgICAgY29uc3QgcmVnaXN0ZXIgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcInJlZ2lzdGVyXCIpO1xyXG4gICAgICAgIGNvbnN0IGNoZWNrVXNlcm5hbWUgPSByZWdpc3Rlci5hZGRSZXNvdXJjZShcImNoZWNrVXNlcm5hbWVcIik7XHJcbiAgICAgICAgY29uc3QgcmF0ZSA9IG1vdmllcy5hZGRSZXNvdXJjZShcInJhdGVcIik7XHJcbiAgICAgICAgY29uc3QgbW92aWVSYXRpbmcgPSBtb3ZpZXMuYWRkUmVzb3VyY2UoXCJyYXRpbmdcIik7XHJcbiAgICAgICAgY29uc3QgdXNlclJhdGluZ3MgPSBtb3ZpZXMuYWRkUmVzb3VyY2UoXCJyYXRpbmdzXCIpO1xyXG4gICAgICAgIGNvbnN0IGRvd25sb2FkID0gbW92aWVzLmFkZFJlc291cmNlKFwiZG93bmxvYWRIaXN0b3J5XCIpO1xyXG4gICAgICAgIGNvbnN0IHVzZXJIaXN0b3J5ID0gbW92aWVzLmFkZFJlc291cmNlKFwiZG93bmxvYWRzXCIpO1xyXG4gICAgICAgIGNvbnN0IHN1YnNjcmliZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwic3Vic2NyaWJlXCIpO1xyXG4gICAgICAgIGNvbnN0IHN1YnNjcmlwdGlvbnMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcInN1YnNjcmlidGlvbnNCeVVzZXJuYW1lXCIpO1xyXG4gICAgICAgIGNvbnN0IG5vdGlmaWNhdGlvbnMgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcIm5vdGlmaWNhdGlvbnNcIik7XHJcbiAgICAgICAgY29uc3QgZ2VuZXJhdGVGZWVkID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJnZW5lcmF0ZUZlZWRcIik7XHJcbiAgICAgICAgY29uc3QgZ2VuZXJhdGVGZWVkRm9yQWxsID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJnZW5lcmF0ZUZlZWRGb3JBbGxcIik7XHJcbiAgICAgICAgY29uc3QgZmVlZCA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiaG9tZVwiKTtcclxuICAgICAgICBjb25zdCBzZWFyY2ggPSBtb3ZpZXMuYWRkUmVzb3VyY2UoXCJzZWFyY2hcIik7XHJcblxyXG4gICAgICAgIG1vdmllc01ldGFkYXRhLmFkZE1ldGhvZChcIlBPU1RcIiwgdXBsb2FkTWV0YWRhdGFJbnRlZ3JhdGlvbik7XHJcbiAgICAgICAgbW92aWVzTWV0YWRhdGEuYWRkTWV0aG9kKFwiUFVUXCIsIHVwZGF0ZU1ldGFkYXRhSW50ZWdyYXRpb24sIHthdXRob3JpemVyOiBhZG1pbkF1dGhvcml6ZXIsXHJcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNVU1RPTSx9KTtcclxuICAgICAgICBtb3ZpZXNNZXRhZGF0YS5hZGRNZXRob2QoXCJERUxFVEVcIiwgZGVsZXRlTWV0YWRhdGFJbnRlZ3JhdGlvbik7XHJcbiAgICAgICAgbW92aWVzVmlkZW8uYWRkTWV0aG9kKFwiUFVUXCIsIHVwZGF0ZU1vdmllSW50ZWdyYXRpb24sIHthdXRob3JpemVyOiBhZG1pbkF1dGhvcml6ZXIsXHJcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNVU1RPTSx9KTtcclxuICAgICAgICBtb3ZpZXNWaWRlby5hZGRNZXRob2QoXCJERUxFVEVcIiwgZGVsZXRlTW92aWVJbnRlZ3JhdGlvbiwge2F1dGhvcml6ZXI6IGFkbWluQXV0aG9yaXplcixcclxuICAgICAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ1VTVE9NLH0pO1xyXG5cclxuICAgICAgICBzdWJzY3JpYmUuYWRkTWV0aG9kKFwiUE9TVFwiLCBzdWJzY3JpYmVJbnRlZ3JhdGlvbik7XHJcbiAgICAgICAgc3Vic2NyaWJlLmFkZE1ldGhvZChcIkdFVFwiLCBnZXRTdWJzY3JpcHRpb25zSW50ZWdyYXRpb24pO1xyXG4gICAgICAgIG5vdGlmaWNhdGlvbnMuYWRkTWV0aG9kKFwiUE9TVFwiLCBzZW5kTm90aWZpY2F0aW9uSW50ZWdyYXRpb24pO1xyXG4gICAgICAgIHNlYXJjaC5hZGRNZXRob2QoXCJQT1NUXCIsIHNlYXJjaEludGVncmF0aW9uLCB7YXV0aG9yaXplcjogYm90aEF1dGhvcml6ZXIsXHJcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNVU1RPTSx9KTtcclxuXHJcbiAgICAgICAgY29uc3QgZG93bmxvYWRNb3ZpZSA9IG1vdmllcy5hZGRSZXNvdXJjZShcImRvd25sb2FkTW92aWVcIik7XHJcbiAgICAgICAgY29uc3QgZG93bmxvYWRNZXRhZGF0YSA9IG1vdmllcy5hZGRSZXNvdXJjZShcImRvd25sb2FkTWV0YWRhdGFcIik7XHJcbiAgICAgICAgY29uc3QgZG93bmxvYWRNZXRhZGF0YUJ5RmlsZU5hbWUgPSBtb3ZpZXMuYWRkUmVzb3VyY2UoXHJcbiAgICAgICAgICAgIFwiZG93bmxvYWRNZXRhZGF0YUJ5RmlsZU5hbWVcIlxyXG4gICAgICAgICk7XHJcbiAgICAgICAgY29uc3QgY2hlY2tJZk1vdmllID0gbW92aWVzLmFkZFJlc291cmNlKFwiY2hlY2tJZk1vdmllXCIpO1xyXG4gICAgICAgIGNvbnN0IGNoZWNrSWZFcGlzb2RlRXhpc3RzID0gbW92aWVzLmFkZFJlc291cmNlKFwiY2hlY2tFcGlzb2RlXCIpO1xyXG4gICAgICAgIGNvbnN0IGRvd25sb2FkTWV0YWRhdGFUdlNob3cgPSBtb3ZpZXMuYWRkUmVzb3VyY2UoXHJcbiAgICAgICAgICAgIFwiZG93bmxvYWRNZXRhZGF0YVR2U2hvd1wiXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgZG93bmxvYWRNb3ZpZS5hZGRNZXRob2QoXCJHRVRcIiwgZG93bmxvYWRNb3ZpZUludGVncmF0aW9uLCB7XHJcbiAgICAgICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAgICAgICBcIm1ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmlkXCI6IHRydWUsXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgZG93bmxvYWRNZXRhZGF0YS5hZGRNZXRob2QoXCJHRVRcIiwgZG93bmxvYWRNZXRhZGF0YUludGVncmF0aW9uLCB7XHJcbiAgICAgICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAgICAgICBcIm1ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmlkXCI6IHRydWUsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGF1dGhvcml6ZXI6IGJvdGhBdXRob3JpemVyLFxyXG4gICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DVVNUT00sXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGRvd25sb2FkTWV0YWRhdGFCeUZpbGVOYW1lLmFkZE1ldGhvZChcclxuICAgICAgICAgICAgXCJHRVRcIixcclxuICAgICAgICAgICAgZG93bmxvYWRNZXRhZGF0YUJ5RmlsZU5hbWVJbnRlZ3JhdGlvbixcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICAgICAgICAgICBcIm1ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmZpbGVOYW1lXCI6IHRydWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgYXV0aG9yaXplcjogYm90aEF1dGhvcml6ZXIsXHJcbiAgICAgICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DVVNUT00sXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBsb2dpbi5hZGRNZXRob2QoXCJQT1NUXCIsIGxvZ2luSW50ZWdyYXRpb24pO1xyXG4gICAgICAgIHJlZ2lzdGVyLmFkZE1ldGhvZChcIlBPU1RcIiwgcmVnaXN0ZXJJbnRlZ3JhdGlvbik7XHJcblxyXG4gICAgICAgIGNoZWNrVXNlcm5hbWUuYWRkTWV0aG9kKFwiR0VUXCIsIGNoZWNrVXNlcm5hbWVJbnRlZ3JhdGlvbiwge1xyXG4gICAgICAgICAgICByZXF1ZXN0UGFyYW1ldGVyczoge1xyXG4gICAgICAgICAgICAgICAgXCJtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy51c2VybmFtZVwiOiB0cnVlLFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNoZWNrSWZNb3ZpZS5hZGRNZXRob2QoXCJHRVRcIiwgY2hlY2tJZk1vdmllSW50ZWdyYXRpb24sIHtcclxuICAgICAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICAgICAgIFwibWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcudGl0bGVcIjogdHJ1ZSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgYXV0aG9yaXplcjogYWRtaW5BdXRob3JpemVyLFxyXG4gICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DVVNUT00sXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgY2hlY2tJZkVwaXNvZGVFeGlzdHMuYWRkTWV0aG9kKFwiR0VUXCIsIGNoZWNrSWZFcGlzb2RlRXhpc3RzSW50ZWdyYXRpb24sIHtcclxuICAgICAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICAgICAgIFwibWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcudGl0bGVcIjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIFwibWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcuZXBpc29kZU51bWJlclwiOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgXCJtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5zZWFzb25OdW1iZXJcIjogdHJ1ZSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgYXV0aG9yaXplcjogYWRtaW5BdXRob3JpemVyLFxyXG4gICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DVVNUT00sXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgZG93bmxvYWRNZXRhZGF0YVR2U2hvdy5hZGRNZXRob2QoXHJcbiAgICAgICAgICAgIFwiR0VUXCIsXHJcbiAgICAgICAgICAgIGRvd25sb2FkTWV0YWRhdGFGb3JUdlNob3dJbnRlZ3JhdGlvbixcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICAgICAgICAgICBcIm1ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLnRpdGxlXCI6IHRydWUsXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgYXV0aG9yaXplcjogYm90aEF1dGhvcml6ZXIsXHJcbiAgICAgICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DVVNUT00sXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG4gICAgICAgIHJhdGUuYWRkTWV0aG9kKFwiUE9TVFwiLCByYXRlTW92aWVJbnRlZ3JhdGlvbiwge2F1dGhvcml6ZXI6IHVzZXJBdXRob3JpemVyfSk7XHJcbiAgICAgICAgbW92aWVSYXRpbmcuYWRkTWV0aG9kKFwiR0VUXCIsIGdldE1vdmllUmF0aW5nSW50ZWdyYXRpb24sIHtcclxuICAgICAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICAgICAgIFwibWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcubW92aWVJZFwiOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgXCJtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy51c2VybmFtZVwiOiB0cnVlLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBhdXRob3JpemVyOiB1c2VyQXV0aG9yaXplcixcclxuICAgICAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ1VTVE9NLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHVzZXJSYXRpbmdzLmFkZE1ldGhvZChcIkdFVFwiLCBnZXRVc2VyUmF0aW5nc0ludGVncmF0aW9uLCB7XHJcbiAgICAgICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAgICAgICBcIm1ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLnVzZXJuYW1lXCI6IHRydWUsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGF1dGhvcml6ZXI6IHVzZXJBdXRob3JpemVyLFxyXG4gICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DVVNUT00sXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgZG93bmxvYWQuYWRkTWV0aG9kKFwiUE9TVFwiLCBkb3dubG9hZEhpc3RvcnlJbnRlZ3JhdGlvbiwge2F1dGhvcml6ZXI6IHVzZXJBdXRob3JpemVyLFxyXG4gICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DVVNUT00sfSk7XHJcbiAgICAgICAgdXNlckhpc3RvcnkuYWRkTWV0aG9kKFwiR0VUXCIsIGdldFVzZXJIaXN0b3J5SW50ZWdyYXRpb24sIHtcclxuICAgICAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICAgICAgIFwibWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcudXNlcm5hbWVcIjogdHJ1ZSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgYXV0aG9yaXplcjogdXNlckF1dGhvcml6ZXIsXHJcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNVU1RPTSxcclxuICAgICAgICB9KTtcclxuICAgICAgICBzdWJzY3JpcHRpb25zLmFkZE1ldGhvZChcIkdFVFwiLCBnZXRTdWJzY3JpcHRpb25zQnlVc2VybmFtZUludGVncmF0aW9uLCB7XHJcbiAgICAgICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAgICAgICBcIm1ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLnVzZXJuYW1lXCI6IHRydWUsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGF1dGhvcml6ZXI6IHVzZXJBdXRob3JpemVyLFxyXG4gICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DVVNUT00sXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgZ2VuZXJhdGVGZWVkLmFkZE1ldGhvZChcIlBPU1RcIiwgZ2VuZXJhdGVGZWVkSW50ZWdyYXRpb24pO1xyXG4gICAgICAgIGdlbmVyYXRlRmVlZEZvckFsbC5hZGRNZXRob2QoXCJQT1NUXCIsIGludm9rZUludGVncmF0aW9uKTtcclxuICAgICAgICBmZWVkLmFkZE1ldGhvZChcIkdFVFwiLCBnZXRGZWVkSW50ZWdyYXRpb24sIHtcclxuICAgICAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICAgICAgIFwibWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcudXNlcm5hbWVcIjogdHJ1ZSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgYXV0aG9yaXplcjogYm90aEF1dGhvcml6ZXIsXHJcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNVU1RPTSxcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufVxyXG4iXX0=