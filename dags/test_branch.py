from airflow import DAG
from airflow.operators.bash_operator import BashOperator
from datetime import datetime, timedelta
from airflow.operators.sensors import SqlSensor
from airflow.operators.python_operator import BranchPythonOperator
from airflow.operators.dummy_operator import DummyOperator
import random

default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "start_date": datetime(2018, 10, 10),
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

dag = DAG("test_branch", default_args=default_args, schedule_interval=timedelta(minutes=5))

t1 = BashOperator(
    task_id="init",
    bash_command="echo lol",
    params={"my_param": "Parameter I passed in"},
    dag=dag,
)

options =["wowww", "wowww2"]
t2 = BranchPythonOperator(
    task_id='branching',
    python_callable=lambda: random.choice(options),
    dag=dag)

t3 = BashOperator(
    task_id="wowww",
    bash_command="echo wowwww",
    params={"my_param": "Parameter I passed in"},
    dag=dag,
)
t4 = DummyOperator(
    task_id='wowww2',
    trigger_rule='one_success',
    dag=dag
)

t2.set_upstream(t1)

t3.set_upstream(t2)
t4.set_upstream(t2)
