from airflow import DAG
from airflow.operators.bash_operator import BashOperator
from datetime import datetime, timedelta


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

dag = DAG("create_question_groups", default_args=default_args, schedule_interval=timedelta(hours=1), catchup=False)


t1 = BashOperator(
    task_id="create_question_groups",
    bash_command="DATABASE_API_CONNECTION=postgres://sixthman:lebrunsux123@sixthman-prod.cbdmxavtswxu.us-west-1.rds.amazonaws.com:5432/sixthman node /usr/local/airflow/src/load_jobs/create_new_question_groups.js",
    pool="create_new_question_groups",
    retries=3,
    dag=dag
)
