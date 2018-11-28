FROM registry.carma.grdf.fr:5000/node

# Configure proxy
ENV http_proxy http://proxygin.melinda.local:8080
ENV https_proxy $http_proxy
ENV ftp_proxy $http_proxy
ENV HTTP_PROXY $http_proxy
ENV HTTPS_PROXY $http_proxy
ENV FTP_PROXY $http_proxy
ENV no_proxy "localhost,127.0.0.1,docker.for.mac.localhost"

WORKDIR /var/www/
#VOLUME /var/www/

RUN echo "#!/bin/bash\nnpm start" > /start.sh
RUN chmod +x /start.sh
ENTRYPOINT ["/start.sh"]
