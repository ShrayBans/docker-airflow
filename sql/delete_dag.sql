delete from xcom where dag_id = 'test_utils';
delete from task_instance where dag_id = 'test_utils';
delete from sla_miss where dag_id = 'test_utils';
delete from log where dag_id = 'test_utils';
delete from job where dag_id = 'test_utils';
delete from dag_run where dag_id = 'test_utils';
delete from dag where dag_id = 'test_utils';