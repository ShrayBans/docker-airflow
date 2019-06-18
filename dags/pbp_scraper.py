from airflow import DAG
from airflow.operators.bash_operator import BashOperator
from datetime import datetime, timedelta
from airflow.operators.sensors import SqlSensor
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

SIXTHMAN_PROD = BaseHook.get_connection("sixthman_prod")
SIXTHMAN_CONN_PASSWORD = SIXTHMAN_PROD.password

dag = DAG("play_by_play_scraper", default_args=default_args, schedule_interval=timedelta(minutes=30), catchup=False)

# t1 = SqlSensor(
#         task_id='30_minutes_before_game_sensor',
#         conn_id='sixthman_prod',
#         pool='play_by_play_scraper',
#         sql="SELECT * FROM nba.game WHERE game_datetime < NOW() + INTERVAL '30 MINUTES' AND status != 'completed';",
#         dag=dag)


t2 = BashOperator(
    task_id="load_pbp",
    bash_command=f"DATABASE_API_CONNECTION=postgres://sixthman:{SIXTHMAN_CONN_PASSWORD}@sixthman-prod.cbdmxavtswxu.us-west-1.rds.amazonaws.com:5432/sixthman REDIS_HOST=socket-server.yoy1ao.0001.usw1.cache.amazonaws.com REDIS_PORT=6379 PLAY_BY_PLAY_QUEUE=prod-pbp node /usr/local/airflow/build/ingestJobs/loadPbpData.js",
    pool='play_by_play_scraper',
    dag=dag,
)

# t2.set_upstream(t1)
