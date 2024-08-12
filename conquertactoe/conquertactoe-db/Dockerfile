FROM postgres:16.3

ARG CACHEBUST=1

COPY init-db/init.sql /docker-entrypoint-initdb.d/
COPY init-db/init-db.sh /docker-entrypoint-initdb.d/

RUN chmod +x /docker-entrypoint-initdb.d/init-db.sh

ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["postgres"]
