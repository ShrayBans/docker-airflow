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

dag = DAG("reddit_scraper", default_args=default_args, schedule_interval=timedelta(hours=1), catchup=False)


t1 = BashOperator(
    task_id="scrape_nba",
    pool="reddit_scraper_nba",
    bash_command="SUBREDDIT=lakers SCRAPING_MODE=latest node /usr/local/airflow/src/cheerio/reddit_scraper.js",
    retries=3,
    dag=dag
 )

t2 = BashOperator(
    task_id="scrape_lakers",
    pool="reddit_scraper_lakers",
    bash_command="SUBREDDIT=lakers SCRAPING_MODE=latest node /usr/local/airflow/src/cheerio/reddit_scraper.js",
    retries=3,
    dag=dag
 )

t3 = BashOperator(
    task_id="scrape_nbastreams",
    pool="reddit_scraper_nbastreams",
    bash_command="SUBREDDIT=nbastreams SCRAPING_MODE=latest TIME_INTERVAL=5000 node /usr/local/airflow/src/cheerio/reddit_scraper.js",
    retries=3,
    dag=dag
 )
t4 = BashOperator(
    task_id="find_nbastreams_link",
    pool="reddit_scraper_nbastreams",
    bash_command="node /usr/local/airflow/src/cheerio/reddit_nbastreams_comments_scraper.js",
    retries=3,
    dag=dag
 )

t4.set_upstream(t3)
