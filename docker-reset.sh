docker stop ifx-postgrid

docker rm ifx-postgrid

docker pull postgres:9.6

docker run \
  -p 5432:5432 \
  --name ifx-postgrid \
  -e POSTGRES_PASSWORD='test' \
  -e POSTGRES_USER='test' \
  -e POSTGRES_DB='postgrid' \
  -d postgres:9.6
