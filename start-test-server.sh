docker pull postgres:9.6

./stop-test-server.sh

docker run \
  -p 5432:5432 \
  --name ifx-postgrid \
  -e POSTGRES_PASSWORD='test' \
  -e POSTGRES_USER='test' \
  -e POSTGRES_DB='test' \
  -d postgres:9.6

  # -v "$PWD/test_data/pgdata:/var/lib/postgresql/data" \
