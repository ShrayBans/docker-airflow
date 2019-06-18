import { AWSError, S3, config } from "aws-sdk";

const s3: S3 = new S3({ apiVersion: "2006-03-01", region: "us-west-1" });

export async function s3PutObject(
    bucket: string,
    key: string,
    params: S3.Types.PutObjectRequest
): Promise<S3.PutObjectOutput> {
    return new Promise(
        (resolve: Function, reject: Function): void => {
            s3.putObject({ Bucket: bucket, Key: key, ...params }, (err: AWSError, response: S3.PutObjectOutput) => {
                if (err) {
                    reject(err);
                }

                resolve(response);
            });
        }
    );
}

export async function s3DeleteObject(
    bucket: string,
    key: string,
    params: S3.Types.DeleteObjectRequest
): Promise<S3.DeleteObjectOutput> {
    return new Promise(
        (resolve: Function, reject: Function): void => {
            s3.deleteObject(
                { Bucket: bucket, Key: key, ...params },
                (err: AWSError, response: S3.DeleteObjectOutput) => {
                    if (err) {
                        reject(err);
                    }

                    resolve(response);
                }
            );
        }
    );
}

export async function listBuckets(): Promise<S3.ListBucketsOutput> {
    return new Promise(
        (resolve: Function, reject: Function): void => {
            s3.listBuckets((err: AWSError, response: S3.ListBucketsOutput) => {
                if (err) {
                    reject(err);
                }

                resolve(response);
            });
        }
    );
}
