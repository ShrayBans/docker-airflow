from airflow import DAG
from airflow.operators.bash_operator import BashOperator
from datetime import datetime, timedelta
from airflow.operators.sensors import SqlSensor


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

dag = DAG("play_by_play_scraper", default_args=default_args, schedule_interval=timedelta(minutes=30), catchup=False)

# t1 = SqlSensor(
#         task_id='30_minutes_before_game_sensor',
#         conn_id='sixthman_prod',
#         pool='play_by_play_scraper',
#         sql="SELECT * FROM nba.game WHERE game_datetime < NOW() + INTERVAL '30 MINUTES' AND status != 'completed';",
#         dag=dag)


t2 = BashOperator(
    task_id="load_pbp",
    bash_command="DATABASE_API_CONNECTION=postgres://sixthman:lebrunsux123@sixthman-prod.cbdmxavtswxu.us-west-1.rds.amazonaws.com:5432/sixthman node /usr/local/airflow/src/load_jobs/load_pbp_data.js",
    pool='play_by_play_scraper',
    dag=dag,
)

# t2.set_upstream(t1)
