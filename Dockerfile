FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
ARG GH_VERSION=2.103.3
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl openssh-client tini \
    && curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" -o "/tmp/gh_${GH_VERSION}_linux_amd64.tar.gz" \
    && curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_checksums.txt" -o /tmp/gh_checksums.txt \
    && cd /tmp && grep " gh_${GH_VERSION}_linux_amd64.tar.gz$" gh_checksums.txt | sha256sum -c - \
    && tar -xzf "gh_${GH_VERSION}_linux_amd64.tar.gz" \
    && install -m 755 "gh_${GH_VERSION}_linux_amd64/bin/gh" /usr/local/bin/gh \
    && useradd --create-home --uid 10001 beam
WORKDIR /app
COPY requirements-cloud.txt ./
RUN pip install -r requirements-cloud.txt
COPY *.py requirements*.txt ./
COPY desktop_static ./desktop_static
COPY templates/desktop.html ./templates/desktop.html
COPY cloud_static ./cloud_static
COPY cloud_templates ./cloud_templates
USER beam
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "exec gunicorn cloud_app:app --bind 0.0.0.0:${PORT:-10000} --workers 1 --worker-class gthread --threads 12 --timeout 240 --access-logfile - --access-logformat '%(h)s %(m)s %(U)s %(s)s'"]
