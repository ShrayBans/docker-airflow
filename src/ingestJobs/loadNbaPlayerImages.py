#!/usr/bin/python

import argparse
import gzip
import json
import os
import sys
import time

import psycopg2
import requests
import sqlalchemy
from sqlalchemy.sql import text

from google_images_download import google_images_download

response = google_images_download.googleimagesdownload()

class PostgresConnection:
    def __init__(self, dbname="sixthman", user="sixthman", host="sixthman-prod.cbdmxavtswxu.us-west-1.rds.amazonaws.com", password=""):
        DB_CONFIG = {
            "dbname": dbname,
            "user": user,
            "host": host,
            "password": password
        }
        connection_uri = "postgresql+psycopg2://{user}:{password}@{host}/{dbname}".format(**DB_CONFIG)
        self.engine = sqlalchemy.create_engine(connection_uri)

LEGACI_PROD_PASS = os.getenv('LEGACI_PROD_PASS')
if LEGACI_PROD_PASS is None:
    print("Please provide a LEGACI_PROD_PASS")
    sys.exit()

conn = PostgresConnection(dbname="sixthman", user="sixthman", host="sixthman-prod.cbdmxavtswxu.us-west-1.rds.amazonaws.com", password=LEGACI_PROD_PASS)


def getNbaPlayers(conn):
    sql = text("""
        SELECT concat(first_name, ' ', last_name) FROM nba.player
    """)
    result = conn.engine.execute(sql)
    rows = result.fetchall()
    return rows

def downloadimages(query):
    # keywords is the search query
    # format is the image file format
    # limit is the number of images to be downloaded
    # print urs is to print the image file url
    # size is the image size which can
    # be specified manually ("large, medium, icon")
    # aspect ratio denotes the height width ratio
    # of images to download. ("tall, square, wide, panoramic")
    arguments = {"keywords": query,
                 "format": "jpg",
                 "limit":4,
                 "print_urls":True,
                 "size": "medium",
                 "aspect_ratio": "tall",
				 "image_directory": "nba_player_images",
				 "prefix": query }
    try:
        response.download(arguments)

    # Handling File NotFound Error
    except FileNotFoundError:
        arguments = {"keywords": query,
                     "format": "jpg",
                     "limit":4,
                     "print_urls":True,
                     "size": "medium"}

        # Providing arguments for the searched query
        try:
            # Downloading the photos based
            # on the given arguments
            response.download(arguments)
        except:
            pass


nbaPlayers = getNbaPlayers(conn)
print(nbaPlayers)
search_queries = [nbaPlayer[0] for nbaPlayer in nbaPlayers]

print(search_queries[:10])

for query in search_queries:
    downloadimages(query)