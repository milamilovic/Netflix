import json
import boto3
import base64
import tempfile
import os
import subprocess

import logging

s3_client = boto3.client('s3')
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    try:
        bucket_name = os.environ['BUCKET_NAME']
        helper_bucket = os.environ['HELPER_BUCKET_NAME']
        for record in event['Records']:
            message_body = json.loads(record['body'])
            video_id = message_body['id']
            file_key = message_body['file_key']
            desired_width = message_body['desired_width']
            desired_height = message_body['desired_height']

            s3_object = s3_client.get_object(Bucket=helper_bucket, Key=file_key)
            logger.info(f"s3 object: {s3_object}")
            logger.info(f"s3 body: {s3_object['Body']}")
            file_content = s3_object['Body'].read()
    
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_output_file: 
                transcode(file_content, desired_width, desired_height, temp_output_file.name)
                with open(temp_output_file.name, 'rb') as f:
                    transcodedBase64 = f.read()
    
            s3_params = {
                'Bucket': bucket_name,
                'Key': video_id + "_" + desired_width + "-" + desired_height,
                'Body': transcodedBase64,
                'ContentType': 'video/mp4'
            }
    
            response = s3_client.put_object(**s3_params)
        
        return {
            'statusCode': 200,
            'headers': {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            },
            'body': json.dumps({"message": "Transcoding successful!"}),
        }
    except subprocess.CalledProcessError as error:
        return {
            'statusCode': 500,
            'headers': {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            },
            'body': json.dumps({"message": "Error with transcoding"}),
        }

def transcode(file_content, desired_width, desired_height, temp_output_file_path):
    try:
        with tempfile.NamedTemporaryFile(delete=False) as temp_input_file: 
            temp_input_file.write(file_content) 
            temp_input_file_path = temp_input_file.name
        ffmpeg_path = '/var/task/bin/ffmpeg'
        command = [
            ffmpeg_path,
            '-i', temp_input_file_path,
            '-vf', f'scale={desired_width}:{desired_height}',
            '-c:a', 'copy',
            '-f', 'mp4',  # Specify the output format
            '-y',
            temp_output_file_path
        ]
        subprocess.run(command, check=True)
    except subprocess.CalledProcessError as e:
        raise Exception(f"ffmpeg error: {str(e)}")
    finally:
        if os.path.exists(temp_input_file_path):
            os.remove(temp_input_file_path)
