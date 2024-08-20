# Netflix clone - streaming platform

## Overview
This project is a Netflix-like video streaming platform designed using cloud-native architecture with AWS services. Users can register, browse, search, rate, download video content, and receive personalized recommendations. Admins can upload, manage, and transcode videos, while the system also handles subscriptions and notifications.

## Features
#### User Features
- Registration & Login: Users can register and log in to the system with a unique username and email.
- Browse & Search Content: Users can view and search video content based on metadata (title, genre, actors, etc.).
- Download & Rate Content: Content can be downloaded, rated using a 1-5 system or similar, and rated.
- Subscription: Users can subscribe to content based on actors, directors, or genres and receive notifications for new uploads.
- Personalized Feed: A customized feed is generated based on user ratings, downloads, and subscriptions.
#### Admin Features
- Upload & Manage Content: Admins can upload video content with associated metadata (title, description, actors, etc.) and edit or delete it.
- Transcoding: Content is automatically transcoded into different resolutions, offering at least three options for users.
#### System Features
- Notifications: Users are notified of new content based on their subscriptions.
- Personalized Recommendations: Recommendations are dynamically updated based on user activity.

## Non-Funtional requirements
- Cloud-native: Designed for AWS, using services like S3, DynamoDB, Lambda, SNS, and API Gateway.
- IaC: Infrastructure managed using Terraform or AWS CloudFormation.
- Scalable & Efficient: Optimized data modeling for high-performance search and event-driven architecture for notifications and processing.

## Technologies
- Pyhton and TypeScript on backend (AWS)
- Angular on fronend
- CDK for deployment

## Developers
- Dunja Matejić SV21/2021
- Mila Milović SV22/2021
- Nenad Berić SV23/2021
