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

dag = DAG("reddit_scraper", default_args=default_args, schedule_interval=timedelta(minutes=1), catchup=False)


t1 = BashOperator(task_id="scrape_nba", bash_command="echo lol", retries=3, dag=dag)
t2 = BashOperator(task_id="scrape_lakers", bash_command="sleep 5", retries=3, dag=dag)
