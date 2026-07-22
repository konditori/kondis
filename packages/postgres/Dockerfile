ARG PG_MAJOR

FROM postgres:${PG_MAJOR}

ARG PG_MAJOR
ARG VECTORCHORD_TAG
ARG TARGETARCH

ENV DB_STORAGE_TYPE=SSD

RUN apt-get update && \
    apt-get install -y wget && \
    wget -nv -O /tmp/vchord.deb https://github.com/tensorchord/VectorChord/releases/download/$VECTORCHORD_TAG/postgresql-${PG_MAJOR%.*}-vchord_${VECTORCHORD_TAG#"v"}-1_${TARGETARCH}.deb && \
    apt-get install -y /tmp/vchord.deb && \
    rm -f /tmp/vchord.deb && \
    apt-get remove -y wget && \
    apt-get autoremove -y && \
    apt-get clean -y && \
    rm -rf /var/lib/apt/lists/*

RUN chmod 1777 /etc/postgresql

COPY postgresql.hdd.conf postgresql.ssd.conf /var/postgresql-conf-tpl/
COPY kondis-docker-entrypoint.sh healthcheck.sh set-env.sh /usr/local/bin/

HEALTHCHECK --interval=5m --start-interval=5s --start-period=5m CMD /usr/local/bin/healthcheck.sh

ENTRYPOINT ["/usr/local/bin/kondis-docker-entrypoint.sh"]

CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
