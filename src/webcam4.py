import collections
import math
import time
import pytz
from random import randint

import cv2
import hydra
import numpy as np
import torch
import datetime
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from ultralytics.yolo.engine.predictor import BasePredictor
from ultralytics.yolo.utils import DEFAULT_CONFIG, ROOT, ops
from ultralytics.yolo.utils.checks import check_imgsz
from ultralytics.yolo.utils.plotting import Annotator, colors, save_one_box

from deep_sort_pytorch.deep_sort import DeepSort
from deep_sort_pytorch.utils.parser import get_config

import firebase_admin
from firebase_admin import credentials, db

deepsort = None

# Define timezone for Indonesia (WIB - UTC+7)
indonesia_tz = pytz.timezone('Asia/Jakarta')

cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://stram-project-default-rtdb.asia-southeast1.firebasedatabase.app'
})

def log_data_to_firebase(object_type, id, median_speed, timestamp, vehicle_direction):
    """Log the vehicle data to Firebase Realtime Database."""
    ref = db.reference('/vehicle_data')
    data = {
        'object_type': object_type,
        'id': id,
        'median_speed': median_speed,
        'timestamp': timestamp,
        'vehicle_direction': vehicle_direction
    }
    
    ref.push(data)
    print(f"Data logged to Firebase: {data}")

def init_tracker():
    global deepsort
    cfg_deep = get_config()
    cfg_deep.merge_from_file("deep_sort_pytorch/configs/deep_sort.yaml")
    deepsort = DeepSort(cfg_deep.DEEPSORT.REID_CKPT,
                        max_dist=cfg_deep.DEEPSORT.MAX_DIST, min_confidence=cfg_deep.DEEPSORT.MIN_CONFIDENCE,
                        nms_max_overlap=cfg_deep.DEEPSORT.NMS_MAX_OVERLAP, max_iou_distance=cfg_deep.DEEPSORT.MAX_IOU_DISTANCE,
                        max_age=cfg_deep.DEEPSORT.MAX_AGE, n_init=cfg_deep.DEEPSORT.N_INIT, nn_budget=cfg_deep.DEEPSORT.NN_BUDGET,
                        use_cuda=True)

rand_color_list = []

# Define a calibration factor for distance
DISTANCE_CALIBRATION_FACTOR = 1.0  # This should be adjusted based on the specific video

def estimatespeed(Location1, Location2, calibration_factor=DISTANCE_CALIBRATION_FACTOR):
    d_pixel = math.sqrt(math.pow(Location2[0] - Location1[0], 2) + math.pow(Location2[1] - Location1[1], 2))
    ppm = 8 * calibration_factor  # pixel per meter, adjusted by calibration factor
    d_meters = d_pixel / ppm
    time_constant = 15 * 3.6
    speed = d_meters * time_constant
    return int(speed)

def xyxy_to_xywh(*xyxy):
    """" Calculates the relative bounding box from absolute pixel values. """
    bbox_left = min([xyxy[0].item(), xyxy[2].item()])
    bbox_top = min([xyxy[1].item(), xyxy[3].item()])
    bbox_w = abs(xyxy[0].item() - xyxy[2].item())
    bbox_h = abs(xyxy[1].item() - xyxy[3].item())
    x_c = (bbox_left + bbox_w / 2)
    y_c = (bbox_top + bbox_h / 2)
    w = bbox_w
    h = bbox_h
    return x_c, y_c, w, h
    
previous_positions = {}
speed_history = collections.defaultdict(list)
speed_per_second = collections.defaultdict(list)
last_update_time = time.time()
SPEED_HISTORY_LENGTH = 5
log_data_buffer = []

start_time = time.time()  # Record the start time of the program

# Adjust the boundary line position
BOUNDARY_OFFSET = 175  # Adjust this value to move the boundary line down

# Initialize counters for vehicles entering and exiting
vehicles_entering = 0
vehicles_exiting = 0
counted_vehicles = {}

def draw_boundary_line(img):
    """Draw a boundary line slightly below the middle of the image."""
    height, width, _ = img.shape
    middle_y = (height // 2) + BOUNDARY_OFFSET
    cv2.line(img, (0, middle_y), (width, middle_y), (0, 0, 255), 2)
    return middle_y

def update_display(img):
    """Draws the boundary line and displays the vehicle counts continuously."""
    global vehicles_entering, vehicles_exiting
    # Draw the boundary line
    height, width, _ = img.shape
    middle_y = (height // 2) + BOUNDARY_OFFSET
    cv2.line(img, (0, middle_y), (width, middle_y), (0, 0, 255), 2)
    # Display the vehicle counts without flickering
    cv2.putText(img, f"Vehicles Entering: {vehicles_entering}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, [255, 255, 255], 2)
    cv2.putText(img, f"Vehicles Exiting: {vehicles_exiting}", (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, [255, 255, 255], 2)

def draw_boxes(img, bbox, identities=None, categories=None, names=None, offset=(0, 0)):
    global previous_positions, speed_history, speed_per_second, last_update_time, log_data_buffer
    global vehicles_entering, vehicles_exiting, counted_vehicles  # Access the global counters
    current_time = time.time()
    local_time = datetime.datetime.now(indonesia_tz)
    formatted_time = local_time.strftime("%Y-%m-%d %H:%M:%S")  # Format as "YYYY-MM-DD HH:MM:SS"
    
    middle_y = draw_boundary_line(img)  # Draw the boundary line and get its y-coordinate
    for i, box in enumerate(bbox):
        x1, y1, x2, y2 = [int(i) for i in box]
        x1 += offset[0]
        x2 += offset[0]
        y1 += offset[1]
        y2 += offset[1]
        id = int(identities[i]) if identities is not None else 0
        category = categories[i] if categories is not None else ""
        label = f"{id} {names[category]}" if names is not None else str(id)
        (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 253), 2)
        cv2.rectangle(img, (x1, y1 - 20), (x1 + w, y1), (255,144,30), -1)
        cv2.putText(img, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, [255, 255, 255], 1)

        # Calculate vehicle speed
        current_position = ((x1 + x2) // 2, (y1 + y2) // 2)
        if id in previous_positions:
            previous_position = previous_positions[id]
            speed = estimatespeed(previous_position, current_position)
            speed_history[id].append(speed)
            speed_per_second[id].append(speed)
            if len(speed_history[id]) > SPEED_HISTORY_LENGTH:
                speed_history[id].pop(0)
            
            # Update median speed per second
            if current_time - last_update_time >= 1:
                for key in speed_per_second:
                    if speed_per_second[key]:
                        median_speed = np.median(speed_per_second[key])
                        speed_per_second[key] = [median_speed]  # Reset list with median value
                last_update_time = current_time

                # Log accumulated data to Google Sheets
                if log_data_buffer:
                        ref = db.reference('/data')
                        for data in log_data_buffer:
                            ref.push(data)
                        print(f"Batch data logged to Firebase: {log_data_buffer}")
                        log_data_buffer.clear()

            # Display median speed
            median_speed = speed_per_second[id][0] if speed_per_second[id] else 0
            cv2.putText(img, f"Speed: {median_speed:.2f} km/h", (x1, y1 - 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, [255, 255, 255], 1)

            # Accumulate data to be logged
            obj_name = names[category] if names is not None else "unknown"
            vehicle_direction = 'unknown'  # Initialize as 'unknown'

            # Check if the vehicle crosses the boundary line
            if previous_position[1] > middle_y >= current_position[1]:
                if counted_vehicles.get(id) != 'exited':
                    vehicles_exiting += 1
                    counted_vehicles[id] = 'exited'
                    vehicle_direction = 'exited'
                    print(f"Vehicle {id} exited. Total exiting: {vehicles_exiting}")
            elif previous_position[1] < middle_y <= current_position[1]:
                if counted_vehicles.get(id) != 'entered':
                    vehicles_entering += 1
                    counted_vehicles[id] = 'entered'
                    vehicle_direction = 'entered'
                    print(f"Vehicle {id} entered. Total entering: {vehicles_entering}")

            # Log data with vehicle_direction
            log_data_buffer.append([obj_name, id, median_speed, formatted_time, vehicle_direction])

        previous_positions[id] = current_position

    return img

def random_color_list():
    global rand_color_list
    rand_color_list = []
    for i in range(0,5005):
        r = randint(0, 255)
        g = randint(0, 255)
        b = randint(0, 255)
        rand_color = (r, g, b)
        rand_color_list.append(rand_color)
    #......................................
        

class DetectionPredictor(BasePredictor):
    
    def get_annotator(self, img):
        return Annotator(img, line_width=self.args.line_thickness, example=str(self.model.names))

    def preprocess(self, img):
        img = torch.from_numpy(img).to(self.model.device)
        img = img.half() if self.model.fp16 else img.float()  # uint8 to fp16/32
        img /= 255  # 0 - 255 to 0.0 - 1.0
        return img

    def postprocess(self, preds, img, orig_img):
        preds = ops.non_max_suppression(preds,
                                        self.args.conf,
                                        self.args.iou,
                                        agnostic=self.args.agnostic_nms,
                                        max_det=self.args.max_det)

        for i, pred in enumerate(preds):
            shape = orig_img[i].shape if self.webcam else orig_img.shape
            pred[:, :4] = ops.scale_boxes(img.shape[2:], pred[:, :4], shape).round()

        return preds

    def write_results(self, idx, preds, batch):
        p, im, im0 = batch
        all_outputs = []
        log_string = ""
        if len(im.shape) == 3:
            im = im[None]  # expand for batch dim
        self.seen += 1
        im0 = im0.copy()
        if self.webcam:  # batch_size >= 1
            log_string += f'{idx}: '
            frame = self.dataset.count
        else:
            frame = getattr(self.dataset, 'frame', 0)

        self.data_path = p
        save_path = str(self.save_dir / p.name)  # im.jpg
        self.txt_path = str(self.save_dir / 'labels' / p.stem) + ('' if self.dataset.mode == 'image' else f'_{frame}')
        log_string += '%gx%g ' % im.shape[2:]  # print string
        self.annotator = self.get_annotator(im0)

        det = preds[idx]
        all_outputs.append(det)
        if len(det) == 0:
            return log_string

        # Filter detections for vehicles only
        vehicle_classes = [2, 3, 5, 7]  # Class IDs for bus, car, motorbike, truck
        det = det[torch.isin(det[:, 5], torch.tensor(vehicle_classes))]

        for c in det[:, 5].unique():
            n = (det[:, 5] == c).sum()  # detections per class
            log_string += f"{n} {self.model.names[int(c)]}{'s' * (n > 1)}, "
        # write
        gn = torch.tensor(im0.shape)[[1, 0, 1, 0]]  # normalization gain whwh
        xywh_bboxs = []
        confs = []
        oids = []
        outputs = []
        for *xyxy, conf, cls in reversed(det):
            x_c, y_c, bbox_w, bbox_h = xyxy_to_xywh(*xyxy)
            xywh_obj = [x_c, y_c, bbox_w, bbox_h]
            xywh_bboxs.append(xywh_obj)
            confs.append([conf.item()])
            oids.append(int(cls))
        xywhs = torch.Tensor(xywh_bboxs)
        confss = torch.Tensor(confs)
        
        # Ensure xywhs has the correct dimensions before calling deepsort.update
        if xywhs.numel() > 0:
            outputs = deepsort.update(xywhs, confss, oids, im0)
            if len(outputs) > 0:
                bbox_xyxy = outputs[:, :4]
                identities = outputs[:, -2]
                object_id = outputs[:, -1]

                draw_boxes(im0, bbox_xyxy, identities, object_id, self.model.names)
                for(identities, object_id) in zip(identities, object_id):
                    obj_name = self.model.names[int(object_id)]
                    obj_id = int(identities)
                    # log_data_to_sheets(obj_name, obj_id) # Log the vehicle data to Google Sheets
        update_display(im0)
        return log_string


@hydra.main(version_base=None, config_path=str(DEFAULT_CONFIG.parent), config_name=DEFAULT_CONFIG.name)
def predict(cfg):
    init_tracker()
    random_color_list()
        
    cfg.model = cfg.model or "yolov8n.pt"
    cfg.imgsz = check_imgsz(cfg.imgsz, min_dim=2)  # check image size
    cfg.source = cfg.source if cfg.source is not None else ROOT / "assets"
    predictor = DetectionPredictor(cfg)
    predictor()


if __name__ == "__main__":
    predict()