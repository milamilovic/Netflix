import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";

import * as path from "path";
import { Construct } from "constructs";
import { get } from "http";

export class Cloud2024Stack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const preRegisterFunction = new lambda.Function(
            this,
            "preRegisterFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "preRegister.handler",
            }
        );

        const userPool = new cognito.UserPool(this, "MovieUserPool", {
            selfSignUpEnabled: true,
            autoVerify: { email: true },
            signInAliases: { username: true },
            lambdaTriggers: {
                preSignUp: preRegisterFunction,
            },
            customAttributes: {
                role: new cognito.StringAttribute({mutable: true}),
            },
        });

        const userPoolClient = new cognito.UserPoolClient(
            this,
            "MovieUserPoolClient",
            {
                userPool,
                authFlows: {
                    userPassword: true,
                },
            }
        );
    
        const authorizeAdminFunction = new lambda.Function(this, 'AuthorizeAdminFunction', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'adminAuthorizer.handler',
            code: lambda.Code.fromAsset(
                path.join(__dirname, "../src/python-lambdas"),
                {
                    bundling: {
                        image: lambda.Runtime.PYTHON_3_8.bundlingImage,
                        command: [
                            "bash",
                            "-c",
                            "pip install -r requirements.txt -t /asset-output && cp -r . /asset-output",
                        ],
                    },
                }
            ),
            environment: {
                USER_POOL_ID: userPool.userPoolId,
                CLIENT_ID: userPoolClient.userPoolClientId,
            },
        });
    
        const authorizeUserFunction = new lambda.Function(this, 'AuthorizeUserFunction', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'userAuthorizer.handler',
            code: lambda.Code.fromAsset(
                path.join(__dirname, "../src/python-lambdas"),
                {
                    bundling: {
                        image: lambda.Runtime.PYTHON_3_8.bundlingImage,
                        command: [
                            "bash",
                            "-c",
                            "pip install -r requirements.txt -t /asset-output && cp -r . /asset-output",
                        ],
                    },
                }
            ),
            environment: {
                USER_POOL_ID: userPool.userPoolId,
                CLIENT_ID: userPoolClient.userPoolClientId,
            },
        });

        const authorizeFunction = new lambda.Function(this, 'AuthorizeFunction', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'authorizer.handler',
            code: lambda.Code.fromAsset(
                path.join(__dirname, "../src/python-lambdas"),
                {
                    bundling: {
                        image: lambda.Runtime.PYTHON_3_8.bundlingImage,
                        command: [
                            "bash",
                            "-c",
                            "pip install -r requirements.txt -t /asset-output && cp -r . /asset-output",
                        ],
                    },
                }
            ),
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
        const subscriptionsTable = new dynamodb.Table(
            this,
            "SubscriptionsTable",
            {
                partitionKey: {
                    name: "userId",
                    type: dynamodb.AttributeType.STRING,
                },
                removalPolicy: cdk.RemovalPolicy.DESTROY,
                tableName: "SubscriptionsTable",
            }
        );

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

        const checkUsernameFunction = new lambda.Function(
            this,
            "checkUsernameFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "checkUsername.handler",
                environment: {
                    COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
                    COGNITO_USER_POOL_ID: userPool.userPoolId,
                },
            }
        );

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

        const uploadMetadataFunction = new lambda.Function(
            this,
            "uploadMetadataFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "uploadMetadata.handler",
                environment: {
                    TABLE_NAME: table.tableName,
                    SQS_QUEUE_URL: notificationsQueue.queueUrl,
                },
            }
        );

        const downloadMovieFunction = new lambda.Function(
            this,
            "downloadMovieFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "downloadMovie.handler",
                environment: {
                    BUCKET_NAME: bucket.bucketName,
                },
            }
        );

        const downloadMetadataFunction = new lambda.Function(
            this,
            "downloadMetadataFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "downloadMetadata.handler",
                environment: {
                    TABLE_NAME: table.tableName,
                },
            }
        );

        const updateMetadataFunction = new lambda.Function(
            this,
            "updateMetadataFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "updateMetadata.handler",
                environment: {
                    TABLE_NAME: table.tableName,
                    SQS_QUEUE_URL: notificationsQueue.queueUrl,
                },
            }
        );

        const transcodingLambda = new lambda.Function(
            this,
            "transcodingLambda",
            {
                runtime: lambda.Runtime.PYTHON_3_8,
                handler: "transcodingLambda.handler",
                code: lambda.Code.fromAsset(
                    path.join(__dirname, "../src/python-lambdas"),
                    {
                        bundling: {
                            image: lambda.Runtime.PYTHON_3_8.bundlingImage,
                            command: [
                                "bash",
                                "-c",
                                "pip install -r requirements.txt -t /asset-output && cp -r . /asset-output",
                            ],
                        },
                    }
                ),
                environment: {
                    PATH: "/var/task/bin",
                    BUCKET_NAME: bucket.bucketName,
                    HELPER_BUCKET_NAME: helperBucket.bucketName,
                    SQS_QUEUE_URL: transcodingQueue.queueUrl,
                },
                timeout: cdk.Duration.seconds(60),
                memorySize: 1024,
                ephemeralStorageSize: cdk.Size.mebibytes(1024),
            }
        );

        transcodingLambda.addEventSource(
            new lambdaEventSources.SqsEventSource(transcodingQueue)
        );

        const uploadMovieFunction = new lambda.Function(
            this,
            "uploadMovieFunction",
            {
                runtime: lambda.Runtime.PYTHON_3_8,
                handler: "uploadMovie.handler",
                code: lambda.Code.fromAsset(
                    path.join(__dirname, "../src/python-lambdas")
                ),
                environment: {
                    PATH: "/var/task/bin",
                    SQS_QUEUE_URL: transcodingQueue.queueUrl,
                    HELPER_BUCKET_NAME: helperBucket.bucketName,
                },
                timeout: cdk.Duration.seconds(60),
                memorySize: 1024,
                ephemeralStorageSize: cdk.Size.mebibytes(1024),
            }
        );

        const downloadMetadataByFileNameFunction = new lambda.Function(
            this,
            "downloadMetadataByFileNameFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "downloadMetadataByFileName.handler",
                environment: {
                    TABLE_NAME: table.tableName,
                },
            }
        );

        const checkIfMovieFunction = new lambda.Function(
            this,
            "checkIfMovieFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "checkIfMovie.handler",
                environment: {
                    TABLE_NAME: table.tableName,
                },
            }
        );

        const checkIfEpisodeExistsFunction = new lambda.Function(
            this,
            "checkIfEpisodeExistsFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "checkIfEpisodeExists.handler",
                environment: {
                    TABLE_NAME: table.tableName,
                },
            }
        );

        const downloadMetadataForTvShowFunction = new lambda.Function(
            this,
            "downloadMetadataForTvShowFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "downloadMetadataForTvShow.handler",
                environment: {
                    TABLE_NAME: table.tableName,
                },
            }
        );

        const deleteMetadataFunction = new lambda.Function(
            this,
            "deleteMetadataFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "deleteMetadata.handler",
                environment: {
                    TABLE_NAME: table.tableName,
                },
            }
        );

        const updateMovieFunction = new lambda.Function(
            this,
            "updateMovieFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "updateMovie.handler",
                environment: {
                    BUCKET_NAME: bucket.bucketName,
                },
            }
        );

        const deleteMovieFunction = new lambda.Function(
            this,
            "deleteMovieFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "deleteMovie.handler",
                environment: {
                    BUCKET_NAME: bucket.bucketName,
                },
            }
        );

        const rateMovieFunction = new lambda.Function(
            this,
            "rateMovieFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "rateMovie.handler",
                environment: {
                    TABLE_NAME: ratingsTable.tableName,
                },
            }
        );

        const getMovieRatingFunction = new lambda.Function(
            this,
            "getMovieRatingFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "getMovieRating.handler",
                environment: {
                    TABLE_NAME: ratingsTable.tableName,
                },
            }
        );

        const getUserRatingsFunction = new lambda.Function(
            this,
            "getUserRatingsFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "getUserRatings.handler",
                environment: {
                    TABLE_NAME: ratingsTable.tableName,
                },
            }
        );

        const downloadHistoryFunction = new lambda.Function(
            this,
            "downloadHistoryFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "downloadHistory.handler",
                environment: {
                    TABLE_NAME: historyTable.tableName,
                },
            }
        );

        const getUserHistoryFunction = new lambda.Function(
            this,
            "getUserDownloadHistoryFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "getDownloadHistory.handler",
                environment: {
                    TABLE_NAME: historyTable.tableName,
                },
            }
        );

        const subscribeFunction = new lambda.Function(
            this,
            "subscribeFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "subscribe.handler",
                environment: {
                    SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
                },
            }
        );

        const getSubscriptionsFunction = new lambda.Function(
            this,
            "getSubscriptionsFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "getSubscriptions.handler",
                environment: {
                    SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
                },
            }
        );

        const getSubscriptionsByUsernameFunction = new lambda.Function(
            this,
            "getSubscriptionsByUsernameFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "getSubscriptionsByUsername.handler",
                environment: {
                    TABLE_NAME: subscriptionsTable.tableName,
                },
            }
        );

        const sendNotificationFunction = new lambda.Function(
            this,
            "sendNotificationFunction",
            {
                runtime: lambda.Runtime.NODEJS_18_X,
                code: lambda.Code.fromAsset("src"),
                handler: "sendNotification.handler",
                environment: {
                    SUBSCRIPTIONS_TABLE_NAME: subscriptionsTable.tableName,
                },
            }
        );

        const generateFeedFunction = new lambda.Function(
            this,
            "generateFeedFunction",
            {
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
            }
        );

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

        sendNotificationFunction.addEventSource(
            new lambdaEventSources.SqsEventSource(notificationsQueue, {
                batchSize: 10, // Number of messages to process per invocation
            })
        );

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

        const loginIntegration = new apigateway.LambdaIntegration(
            loginFunction
        );
        const registerIntegration = new apigateway.LambdaIntegration(
            registerFunction
        );
        const checkUsernameIntegration = new apigateway.LambdaIntegration(
            checkUsernameFunction
        );
        const uploadMetadataIntegration = new apigateway.LambdaIntegration(
            uploadMetadataFunction
        );
        const downloadMovieIntegration = new apigateway.LambdaIntegration(
            downloadMovieFunction
        );
        const downloadMetadataIntegration = new apigateway.LambdaIntegration(
            downloadMetadataFunction
        );
        const updateMetadataIntegration = new apigateway.LambdaIntegration(
            updateMetadataFunction
        );
        const deleteMetadataIntegration = new apigateway.LambdaIntegration(
            deleteMetadataFunction
        );
        const updateMovieIntegration = new apigateway.LambdaIntegration(
            updateMovieFunction
        );
        const deleteMovieIntegration = new apigateway.LambdaIntegration(
            deleteMovieFunction
        );
        const downloadMetadataByFileNameIntegration =
            new apigateway.LambdaIntegration(
                downloadMetadataByFileNameFunction
            );
        const checkIfMovieIntegration = new apigateway.LambdaIntegration(
            checkIfMovieFunction
        );
        const checkIfEpisodeExistsIntegration =
            new apigateway.LambdaIntegration(checkIfEpisodeExistsFunction);
        const downloadMetadataForTvShowIntegration =
            new apigateway.LambdaIntegration(downloadMetadataForTvShowFunction);
        const rateMovieIntegration = new apigateway.LambdaIntegration(
            rateMovieFunction
        );
        const getMovieRatingIntegration = new apigateway.LambdaIntegration(
            getMovieRatingFunction
        );
        const getUserRatingsIntegration = new apigateway.LambdaIntegration(
            getUserRatingsFunction
        );
        const downloadHistoryIntegration = new apigateway.LambdaIntegration(
            downloadHistoryFunction
        );
        const getUserHistoryIntegration = new apigateway.LambdaIntegration(
            getUserHistoryFunction
        );
        const subscribeIntegration = new apigateway.LambdaIntegration(
            subscribeFunction
        );
        const getSubscriptionsIntegration = new apigateway.LambdaIntegration(
            getSubscriptionsFunction
        );
        const getSubscriptionsByUsernameIntegration =
            new apigateway.LambdaIntegration(
                getSubscriptionsByUsernameFunction
            );
        const sendNotificationIntegration = new apigateway.LambdaIntegration(
            sendNotificationFunction
        );
        const generateFeedIntegration = new apigateway.LambdaIntegration(
            generateFeedFunction
        );
        const getFeedIntegration = new apigateway.LambdaIntegration(
            getFeedFunction
        );
        const invokeIntegration = new apigateway.LambdaIntegration(
            invokeLambda
        );
        const searchIntegration = new apigateway.LambdaIntegration(
            searchFunction
        );

        //transcoding
        bucket.grantReadWrite(transcodingLambda);
        /*const transcodingIntegration = new apigateway.LambdaIntegration(
            transcodingLambda
        );*/
        const uploadMovieIntegration = new apigateway.LambdaIntegration(
            uploadMovieFunction
        );
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
        moviesMetadata.addMethod("PUT", updateMetadataIntegration, {authorizer: adminAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,});
        moviesMetadata.addMethod("DELETE", deleteMetadataIntegration);
        moviesVideo.addMethod("PUT", updateMovieIntegration, {authorizer: adminAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,});
        moviesVideo.addMethod("DELETE", deleteMovieIntegration, {authorizer: adminAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,});

        subscribe.addMethod("POST", subscribeIntegration);
        subscribe.addMethod("GET", getSubscriptionsIntegration);
        notifications.addMethod("POST", sendNotificationIntegration);
        search.addMethod("POST", searchIntegration, {authorizer: bothAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,});

        const downloadMovie = movies.addResource("downloadMovie");
        const downloadMetadata = movies.addResource("downloadMetadata");
        const downloadMetadataByFileName = movies.addResource(
            "downloadMetadataByFileName"
        );
        const checkIfMovie = movies.addResource("checkIfMovie");
        const checkIfEpisodeExists = movies.addResource("checkEpisode");
        const downloadMetadataTvShow = movies.addResource(
            "downloadMetadataTvShow"
        );

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

        downloadMetadataByFileName.addMethod(
            "GET",
            downloadMetadataByFileNameIntegration,
            {
                requestParameters: {
                    "method.request.querystring.fileName": true,
                },
                authorizer: bothAuthorizer,
                authorizationType: apigateway.AuthorizationType.CUSTOM,
            }
        );

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
        downloadMetadataTvShow.addMethod(
            "GET",
            downloadMetadataForTvShowIntegration,
            {
                requestParameters: {
                    "method.request.querystring.title": true,
                },
                authorizer: bothAuthorizer,
                authorizationType: apigateway.AuthorizationType.CUSTOM,
            }
        );
        rate.addMethod("POST", rateMovieIntegration, {authorizer: userAuthorizer});
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
        download.addMethod("POST", downloadHistoryIntegration, {authorizer: userAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,});
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
