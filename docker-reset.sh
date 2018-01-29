docker stop sqlgrid

docker rm sqlgrid

docker pull postgres:9.6

docker run \
  -p 5432:5432 \
  --name sqlgrid \
  -e POSTGRES_PASSWORD='test' \
  -e POSTGRES_USER='test' \
  -e POSTGRES_DB='sqlgrid' \
  -d postgres:9.6
