from airflow import DAG
from airflow.operators.bash_operator import BashOperator
from datetime import datetime, timedelta
from airflow.hooks.base_hook import BaseHook
import psycopg2


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

SIXTHMAN_PROD = BaseHook.get_connection("sixthman_prod")
SIXTHMAN_CONN_PASSWORD = SIXTHMAN_PROD.password

hook = SIXTHMAN_PROD.get_hook()
sub_reddits = hook.get_records("SELECT DISTINCT(sub_reddit) FROM core.channel")

dag = DAG("reddit_nba_teams_scraper", default_args=default_args, schedule_interval=timedelta(minutes=45), catchup=False)

for sub_reddit in sub_reddits:
    sub_reddit_name = sub_reddit[0]

    t1 = BashOperator(
        task_id=f"scrape_{sub_reddit_name}",
        pool="reddit_scraper_nba_teams",
        bash_command=f"DATABASE_API_CONNECTION=postgres://sixthman:{SIXTHMAN_CONN_PASSWORD}@sixthman-prod.cbdmxavtswxu.us-west-1.rds.amazonaws.com:5432/sixthman SUBREDDIT={sub_reddit_name} SCRAPING_MODE=latest node /usr/local/airflow/src/cheerio/reddit_scraper.js",
        retries=3,
        dag=dag
    )

