from airflow import DAG
from airflow.operators.bash_operator import BashOperator
from datetime import datetime, timedelta
from airflow.operators.sensors import S3KeySensor


default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "start_date": datetime(2018, 10, 14),
    "email": ["bansalshray@gmail.com"],
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
    # 'queue': 'bash_queue',
    # 'pool': 'backfill',
    # 'priority_weight': 10,
    # 'end_date': datetime(2016, 1, 1),
}

dag = DAG("s3_sensor_example", default_args=default_args, schedule_interval=timedelta(minutes=30), catchup=False)

s3_sensor = S3KeySensor(
    task_id='s3_sensor',
    bucket_key='sensor_test/*',
    wildcard_match=True,
    bucket_name='cdn.getsixthman.com',
    s3_conn_id='sixthman_airflow_s3',
    dag=dag
)

t2 = BashOperator(task_id="sleep", bash_command="sleep 5", retries=3, dag=dag)

t3 = BashOperator(
    task_id="templated",
    bash_command="echo wooooooooo",
    dag=dag,
)

t2.set_upstream(s3_sensor)
t3.set_upstream(s3_sensor)
