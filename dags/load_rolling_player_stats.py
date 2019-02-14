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

dag = DAG("load_rolling_player_stats", default_args=default_args, schedule_interval=timedelta(days=1), catchup=False)

t1 = BashOperator(
    task_id="load_rolling_player_stats_task",
    pool="load_rolling_player_stats",
    bash_command=f"DATABASE_API_CONNECTION=postgres://sixthman:{SIXTHMAN_CONN_PASSWORD}@sixthman-prod.cbdmxavtswxu.us-west-1.rds.amazonaws.com:5432/sixthman REDIS_HOST=socket-server.yoy1ao.0001.usw1.cache.amazonaws.com REDIS_PORT=6379 npx ts-node /usr/local/airflow/src/createJobs/createRollingPlayerStats.ts",
    retries=3,
    dag=dag
)

