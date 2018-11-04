from airflow import DAG
from airflow.operators.bash_operator import BashOperator
from datetime import datetime, timedelta
from airflow.hooks.base_hook import BaseHook


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

dag = DAG("youtube_scraper_nba_highlights", default_args=default_args, schedule_interval=timedelta(minutes=30), catchup=False)


SIXTHMAN_PROD = BaseHook.get_connection("sixthman_prod")
SIXTHMAN_CONN_PASSWORD = SIXTHMAN_PROD.password

CMD = (
    f"DATABASE_API_CONNECTION=postgres://sixthman:{SIXTHMAN_CONN_PASSWORD}@sixthman-prod.cbdmxavtswxu.us-west-1.rds.amazonaws.com:5432/sixthman"
    " node /usr/local/airflow/src/cheerio/youtube_scraper_nba_highlights.js"
)

print(CMD)

t1 = BashOperator(
    task_id="youtube_scraper_nba_highlights",
    pool="youtube_scraper_nba_highlights",
    bash_command=CMD,
    retries=1,
    dag=dag
 )
