-- MySQL dump 10.13  Distrib 8.0.36, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: thuyet_minh
-- ------------------------------------------------------
-- Server version	8.4.13-0ubuntu0.26.04.2

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `diem_tham_quan`
--

DROP TABLE IF EXISTS `diem_tham_quan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `diem_tham_quan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_diem` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vi_do` decimal(10,7) NOT NULL,
  `kinh_do` decimal(10,7) NOT NULL,
  `ban_kinh_m` int NOT NULL,
  `hinh_anh` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thu_tu` int NOT NULL,
  `dang_dung` tinyint(1) NOT NULL,
  `ngay_tao` datetime NOT NULL,
  `ngay_cap_nhat` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  CONSTRAINT `chk_ban_kinh` CHECK ((`ban_kinh_m` between 20 and 2000)),
  CONSTRAINT `chk_kinh_do` CHECK ((`kinh_do` between 0 and 180)),
  CONSTRAINT `chk_vi_do` CHECK ((`vi_do` between 0 and 90))
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `diem_tham_quan`
--

LOCK TABLES `diem_tham_quan` WRITE;
/*!40000 ALTER TABLE `diem_tham_quan` DISABLE KEYS */;
INSERT INTO `diem_tham_quan` VALUES (1,'ben-thanh','Chợ Bến Thành',10.7725000,106.6980000,120,NULL,1,1,'2026-10-29 15:32:42','2026-10-29 15:32:42'),(2,'independence-palace','Dinh Độc Lập',10.7770000,106.6953000,120,NULL,2,1,'2026-10-29 15:32:42','2026-10-29 15:32:42'),(3,'notre-dame','Nhà thờ Đức Bà',10.7798000,106.6990000,55,NULL,3,1,'2026-10-29 15:32:42','2026-10-29 15:32:42'),(4,'central-post','Bưu điện Trung tâm',10.7799000,106.7000000,45,NULL,4,1,'2026-10-29 15:32:42','2026-10-29 15:32:42'),(5,'opera-house','Nhà hát Thành phố',10.7765000,106.7030000,100,NULL,5,1,'2026-10-29 15:32:42','2026-10-29 15:32:42'),(6,'nguyen-hue','Phố đi bộ Nguyễn Huệ',10.7740000,106.7030000,150,NULL,6,1,'2026-10-29 15:32:42','2026-10-29 15:32:42'),(8,'truong-dai-hoc-sai-gon','Trường đại học sài gòn ',10.7599171,106.6822583,200,NULL,7,1,'2026-10-30 08:21:51','2026-10-30 08:21:51');
/*!40000 ALTER TABLE `diem_tham_quan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lich_su_nghe`
--

DROP TABLE IF EXISTS `lich_su_nghe`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lich_su_nghe` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ma_su_kien` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `luot_truy_cap_id` bigint NOT NULL,
  `diem_id` int NOT NULL,
  `ma_ngon_ngu` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `thoi_gian_nghe` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_su_kien` (`ma_su_kien`),
  KEY `ma_ngon_ngu` (`ma_ngon_ngu`),
  KEY `idx_lsn_diem` (`diem_id`,`thoi_gian_nghe`),
  KEY `fk_lsn_luot` (`luot_truy_cap_id`),
  CONSTRAINT `fk_lsn_luot` FOREIGN KEY (`luot_truy_cap_id`) REFERENCES `luot_truy_cap` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `lich_su_nghe_ibfk_2` FOREIGN KEY (`diem_id`) REFERENCES `diem_tham_quan` (`id`),
  CONSTRAINT `lich_su_nghe_ibfk_3` FOREIGN KEY (`ma_ngon_ngu`) REFERENCES `ngon_ngu` (`ma_ngon_ngu`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lich_su_nghe`
--

LOCK TABLES `lich_su_nghe` WRITE;
/*!40000 ALTER TABLE `lich_su_nghe` DISABLE KEYS */;
INSERT INTO `lich_su_nghe` VALUES (1,'74af3401-c7e0-40d3-ac35-a244d1a18fc2',1,1,'vi','2026-10-29 15:36:20'),(2,'0c9dcfe0-0120-4cb6-86bf-9b13844fc809',1,1,'en','2026-10-29 15:36:30'),(3,'4495d77f-df2c-4b27-8ba2-88600ed1b3f6',1,1,'ko','2026-10-29 15:36:45'),(4,'deb8dccd-5595-4099-93d3-4e4b552dd9bb',6,4,'vi','2026-10-29 15:59:02'),(5,'11e2785d-46e0-465f-a44b-0c62e6337689',2,1,'vi','2026-10-29 16:58:52'),(6,'f95975a0-72da-483e-a514-9872fc795ab7',8,3,'vi','2026-10-29 17:22:37'),(7,'9426a915-81d9-46e1-affa-64759f803f4d',12,2,'vi','2026-10-29 20:42:03'),(8,'c6b17a6b-c68a-4101-9bc3-e33b2658f0b3',12,2,'vi','2026-10-29 20:42:08'),(9,'0f69f5d0-89b6-4f45-8fdf-43687912c2bd',13,2,'vi','2026-10-30 07:28:12');
/*!40000 ALTER TABLE `lich_su_nghe` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `luot_truy_cap`
--

DROP TABLE IF EXISTS `luot_truy_cap`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `luot_truy_cap` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ma_su_kien` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ma_phien` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ma_ngon_ngu` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thoi_gian_truy_cap` datetime NOT NULL,
  `thoi_gian_dong_bo` datetime NOT NULL,
  `loai_thiet_bi` enum('mobile','tablet','desktop','khac') COLLATE utf8mb4_unicode_ci NOT NULL,
  `thiet_bi` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_ma_hoa` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_su_kien` (`ma_su_kien`),
  KEY `ma_ngon_ngu` (`ma_ngon_ngu`),
  KEY `ix_luot_truy_cap_ma_phien` (`ma_phien`),
  KEY `idx_thoi_gian` (`thoi_gian_truy_cap`),
  CONSTRAINT `luot_truy_cap_ibfk_1` FOREIGN KEY (`ma_ngon_ngu`) REFERENCES `ngon_ngu` (`ma_ngon_ngu`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `luot_truy_cap`
--

LOCK TABLES `luot_truy_cap` WRITE;
/*!40000 ALTER TABLE `luot_truy_cap` DISABLE KEYS */;
INSERT INTO `luot_truy_cap` VALUES (1,'70eda9ee-24ef-4621-a373-ac1c89631023','bf9204e9-dd71-4a4c-865d-1275ccc52440','vi','2026-10-29 15:34:52','2026-10-29 15:34:52','desktop','Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0','9c058899905c0f7c91f6e8d874bff6bcda0bbb0cce7ac2814c314a3b8c27f3da'),(2,'14a4de28-4754-4439-9745-70611b3376dc','bf9204e9-dd71-4a4c-865d-1275ccc52440','vi','2026-10-29 15:52:37','2026-10-29 15:52:37','desktop','Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0','9c058899905c0f7c91f6e8d874bff6bcda0bbb0cce7ac2814c314a3b8c27f3da'),(3,'2621f192-9811-4b37-b428-29abbcd5bbdd','04a7098b-dc60-4cf5-a250-37b44c107575',NULL,'2026-10-29 15:54:55','2026-10-29 15:54:55','desktop','Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0','bfebbdb4fd433e7876a75a6d6c2fe659b623cf2fd0df82d329d4e3e220ac01cb'),(4,'ea39129f-c676-4fea-9fd6-ee8855f0e588','bd72222b-4ad8-49d8-a6c8-549cecf8fa08','en','2026-10-29 15:56:11','2026-10-29 15:56:12','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1','7ee4aee847b77df5beae7cc1dab02255a3615469656a35ec09ced4e441f4b0d9'),(5,'1abe2cfa-5557-4bed-a5f9-4dda3e2edb48','bd72222b-4ad8-49d8-a6c8-549cecf8fa08','en','2026-10-29 15:57:45','2026-10-29 15:57:45','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1','7ee4aee847b77df5beae7cc1dab02255a3615469656a35ec09ced4e441f4b0d9'),(6,'9190ca6e-154e-4350-af21-6f3b565790c3','bd72222b-4ad8-49d8-a6c8-549cecf8fa08','vi','2026-10-29 15:58:11','2026-10-29 15:58:11','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1','7ee4aee847b77df5beae7cc1dab02255a3615469656a35ec09ced4e441f4b0d9'),(7,'a9817b3d-9bac-429a-b062-4486b62e8720','bd72222b-4ad8-49d8-a6c8-549cecf8fa08','vi','2026-10-29 16:57:52','2026-10-29 16:57:52','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1','7ee4aee847b77df5beae7cc1dab02255a3615469656a35ec09ced4e441f4b0d9'),(8,'4206132e-d777-46d2-8956-68d58986c63d','5a2db7b6-faa8-4e8b-90af-87ada506f163','vi','2026-10-29 17:21:49','2026-10-29 17:21:49','desktop','Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0','27148cc62504230fd131dc89de105c2ca4a45284480c7d675d50c40d348bbff7'),(9,'48893f26-d577-4ed7-94bd-461e6d8a03df','d0acba87-199a-47c8-b0c4-375ad17c8072','vi','2026-10-29 19:57:48','2026-10-29 19:57:49','desktop','Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0','5ddea64f884edc00d8a2740aa9c32ffaeda2c08230ee9afa5580eaacf41eb1b9'),(10,'54a7e673-59fd-456e-a6ec-18287ee683d9','0b8b292d-403f-42b0-9ae9-9b4bd7a21bc1','vi','2026-10-29 20:38:54','2026-10-29 20:38:54','desktop','Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0','5ddea64f884edc00d8a2740aa9c32ffaeda2c08230ee9afa5580eaacf41eb1b9'),(11,'ae8c52eb-24ec-4100-8175-c2a97f66a8fd','cde808b0-8458-4053-a72e-d260191cd88a',NULL,'2026-10-29 20:40:08','2026-10-29 20:40:09','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1','7ee4aee847b77df5beae7cc1dab02255a3615469656a35ec09ced4e441f4b0d9'),(12,'f2e4fc2c-4653-42af-98ab-78feafa5971a','687fa420-3fa0-4a88-ac9d-0e756cbbbed9','vi','2026-10-29 20:40:19','2026-10-29 20:40:20','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1','7ee4aee847b77df5beae7cc1dab02255a3615469656a35ec09ced4e441f4b0d9'),(13,'a212edaf-0c17-4d95-b376-f3d6b4ae3ff9','b9ca42bf-e9a5-44f2-ae97-f9327ec8e812','vi','2026-10-30 07:24:48','2026-10-30 07:24:48','desktop','Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0','49b943c1a938d8c7f240b233b978cb170e84d0f96152a8b6880de3ba5c6f04df'),(14,'e39f126b-58a6-4b75-b82c-9c4b40afb146','f8873bd2-6ca5-4196-b554-8609d9905469','en','2026-10-30 07:26:02','2026-10-30 07:26:02','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1','1118489eb6a82affe2dc875274e6bfd29ee5edce6a5cb4421ea70d0b0fd28e08'),(15,'11013671-c632-4130-9515-6ef3f6ba3a5e','75e22592-b723-4991-a446-17f1323ce5e9',NULL,'2026-10-30 07:50:46','2026-10-30 07:50:46','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1','c209acf98fcb705137d98c6cd2fc89e733383fd5de7a172547634cdb376e2294'),(16,'af42dee5-dee8-4e43-98ab-327f5cace1f2','df0b85d8-ccba-4386-8d1f-75e6d9834e43','vi','2026-10-30 07:50:53','2026-10-30 07:50:53','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1','c209acf98fcb705137d98c6cd2fc89e733383fd5de7a172547634cdb376e2294'),(18,'1770a9d5-ac13-4e68-a243-29517fba5242','df0b85d8-ccba-4386-8d1f-75e6d9834e43','en','2026-10-30 09:22:42','2026-10-30 09:22:42','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1','c209acf98fcb705137d98c6cd2fc89e733383fd5de7a172547634cdb376e2294'),(19,'01c9253e-ff76-4523-84af-1a421f26f388','69a8396a-7208-4b63-9609-b3407a389dc8','en','2026-10-30 09:22:43','2026-10-30 09:22:43','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1','4a7c8454707f830c71b5d80158ecf156fa0d467090edd6067a99883fb8ad28f7'),(20,'5067ca51-c3eb-4135-9811-223e32e7f7bc','69a8396a-7208-4b63-9609-b3407a389dc8','en','2026-10-30 09:29:25','2026-10-30 09:29:25','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1','4a7c8454707f830c71b5d80158ecf156fa0d467090edd6067a99883fb8ad28f7'),(21,'97270d78-012c-4912-8c68-803e55be9f66','6d991943-bb20-4ab7-9fa0-f660a228ad69',NULL,'2026-11-15 22:37:25','2026-11-15 22:37:25','desktop','Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0','9c058899905c0f7c91f6e8d874bff6bcda0bbb0cce7ac2814c314a3b8c27f3da'),(22,'2ab86f1f-a3bd-4ebb-96a3-42f2e50e9c10','66ae3973-ab7d-400e-b232-13dc6e735454','en','2026-11-15 22:39:43','2026-11-15 22:39:43','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1','145b08b9b0be74ee6f112217eb20fcd924664366c458a1c2d89a26f7a1a55208'),(23,'9bee6658-44fc-429f-8223-f385f34a3a35','66ae3973-ab7d-400e-b232-13dc6e735454','en','2026-11-15 22:53:59','2026-11-15 22:53:59','mobile','Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1','145b08b9b0be74ee6f112217eb20fcd924664366c458a1c2d89a26f7a1a55208');
/*!40000 ALTER TABLE `luot_truy_cap` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ngon_ngu`
--

DROP TABLE IF EXISTS `ngon_ngu`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ngon_ngu` (
  `ma_ngon_ngu` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_ban_ngu` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ten_tieng_viet` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ma_giong_doc` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thu_tu` int NOT NULL,
  `la_mac_dinh` tinyint(1) NOT NULL,
  `dang_dung` tinyint(1) NOT NULL,
  PRIMARY KEY (`ma_ngon_ngu`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ngon_ngu`
--

LOCK TABLES `ngon_ngu` WRITE;
/*!40000 ALTER TABLE `ngon_ngu` DISABLE KEYS */;
INSERT INTO `ngon_ngu` VALUES ('en','English','Tiếng Anh','en-US',2,0,1),('es','Español','Tiếng Tây Ban Nha','es-ES',3,0,1),('ko','한국어','Tiếng Hàn','ko-KR',4,0,1),('ru','Русский','Tiếng Nga','ru-RU',6,0,1),('vi','Tiếng Việt','Tiếng Việt','vi-VN',1,1,1),('zh','中文','Tiếng Trung','zh-CN',5,0,1);
/*!40000 ALTER TABLE `ngon_ngu` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `noi_dung_diem`
--

DROP TABLE IF EXISTS `noi_dung_diem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `noi_dung_diem` (
  `id` int NOT NULL AUTO_INCREMENT,
  `diem_id` int NOT NULL,
  `ma_ngon_ngu` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tieu_de` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mo_ta_ngan` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `noi_dung` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `duong_dan_am_thanh` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `am_thanh_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trang_thai` enum('nhap','da_dang') COLLATE utf8mb4_unicode_ci NOT NULL,
  `ngay_cap_nhat` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_diem_ngonngu` (`diem_id`,`ma_ngon_ngu`),
  KEY `ma_ngon_ngu` (`ma_ngon_ngu`),
  CONSTRAINT `fk_nd_diem` FOREIGN KEY (`diem_id`) REFERENCES `diem_tham_quan` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `noi_dung_diem_ibfk_2` FOREIGN KEY (`ma_ngon_ngu`) REFERENCES `ngon_ngu` (`ma_ngon_ngu`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `noi_dung_diem`
--

LOCK TABLES `noi_dung_diem` WRITE;
/*!40000 ALTER TABLE `noi_dung_diem` DISABLE KEYS */;
INSERT INTO `noi_dung_diem` VALUES (1,1,'vi','Chợ Bến Thành','Biểu tượng hơn 100 năm giữa lòng Sài Gòn.','Chợ Bến Thành được xây dựng hoàn thành năm 1914, là biểu tượng của Thành phố Hồ Chí Minh và là nơi bán đủ loại hàng hóa, ẩm thực địa phương.','1_vi.mp3','fe131659709ff29434d38b92b147cdae44bd5bd00bd3b757ee72e7c7fd5da38d','da_dang','2026-10-29 15:32:54'),(2,1,'en','Ben Thanh Market','A 100-year-old symbol in the heart of Saigon.','Ben Thanh Market was completed in 1914. It is a symbol of Ho Chi Minh City, offering a wide range of goods and local food.','1_en.mp3','47613d622cd200a28a29b588674b36163885ff0bbda31094df33c5f4ed92e6ce','da_dang','2026-10-29 15:32:55'),(3,1,'es','Mercado de Ben Thanh','Un símbolo de más de 100 años en el corazón de Saigón.','El mercado de Ben Thanh se terminó de construir en 1914. Es un símbolo de la ciudad de Ho Chi Minh y ofrece todo tipo de productos y gastronomía local.','1_es.mp3','c9e39876fcde24cfd2bdebee23a8230b26a2ec8d510e3c4ff2d6d15b147dca24','da_dang','2026-10-29 15:32:57'),(4,1,'ko','벤탄 시장','사이공 중심부를 지켜 온 100년 넘은 상징.','벤탄 시장은 1914년에 완공되었으며 호찌민시의 상징입니다. 다양한 상품과 현지 음식을 만나볼 수 있는 곳입니다.','1_ko.mp3','6decea97a9c4e940a4006f0916e948fa3759a50fda2e53cc7b7183d95d61f0a0','da_dang','2026-10-29 15:32:58'),(5,1,'zh','滨城市场','矗立在西贡中心、已有百余年历史的象征。','滨城市场于1914年建成，是胡志明市的象征，这里出售各种商品和地道的当地美食。','1_zh.mp3','8b061cb812b648816876c6580656b835904673f532168722335e642ed92d1b43','da_dang','2026-10-29 15:32:59'),(6,1,'ru','Рынок Бентхань','Символ Сайгона, которому больше 100 лет.','Рынок Бентхань был построен в 1914 году и стал символом Хошимина. Здесь продают самые разные товары и местные блюда.','1_ru.mp3','e49c437d1d97c3cf2d521453c222831a20e7ad7800a8f48ddfdc25ee682f2cc3','da_dang','2026-10-29 15:33:00'),(7,2,'vi','Dinh Độc Lập','Dấu ấn lịch sử và kiến trúc hiện đại độc đáo.','Dinh Độc Lập là nơi diễn ra sự kiện lịch sử ngày 30 tháng 4 năm 1975, đánh dấu thống nhất đất nước.','2_vi.mp3','f621b03e8480bf14beb6a347eb05853c8bde11ac484a6a3d3bbf37310cdc2f90','da_dang','2026-10-29 15:33:01'),(8,2,'en','Independence Palace','A historic site with distinctive modernist architecture.','Independence Palace is where the historic events of April 30, 1975 took place, marking the reunification of Vietnam.','2_en.mp3','3baf6bcdd053c856833aad7f2fcfa26098d5f32061d08ae84779b98424495e6a','da_dang','2026-10-29 15:33:02'),(9,2,'es','Palacio de la Independencia','Un lugar histórico de arquitectura moderna muy particular.','El Palacio de la Independencia fue escenario de los hechos históricos del 30 de abril de 1975, que marcaron la reunificación de Vietnam.','2_es.mp3','ea81fefa26e85032768361ea523728638426f91ebe19e61338b54941a50b4e6d','da_dang','2026-10-29 15:33:03'),(10,2,'ko','통일궁','역사의 흔적과 독특한 현대 건축이 어우러진 곳.','통일궁은 1975년 4월 30일 역사적인 사건이 일어난 곳으로, 베트남 통일을 알린 장소입니다.','2_ko.mp3','e06770f013c7ce1865ba64e6a0c4fde0683b89df0053ca713ebb040eda54e28e','da_dang','2026-10-29 15:33:04'),(11,2,'zh','独立宫','兼具历史印记与独特现代建筑的地标。','独立宫是1975年4月30日历史性事件的发生地，标志着越南国家统一。','2_zh.mp3','14f7d5d3dc9b2b3d8ad40350aec09a4ab094738f391327f177694c3290018cc7','da_dang','2026-10-29 15:33:05'),(12,2,'ru','Дворец Независимости','Историческое место с необычной современной архитектурой.','Во Дворце Независимости 30 апреля 1975 года произошли исторические события, ознаменовавшие объединение Вьетнама.','2_ru.mp3','df08ae9ae99574668c3ba57e5a19e914e38de13dc02fde2929b28cd1cdeb4092','da_dang','2026-10-29 15:33:06'),(13,3,'vi','Nhà thờ Đức Bà','Công trình kiến trúc Pháp giữa trung tâm thành phố.','Nhà thờ Đức Bà được xây dựng từ năm 1863 đến 1880, với hai tháp chuông cao 58 mét và toàn bộ gạch được nhập từ Pháp.','3_vi.mp3','71f2f3670b3227745a3d83f85c8aa09242cd0f70b4d31ccb8022a5ebbd65fa40','da_dang','2026-10-29 15:33:07'),(14,3,'en','Notre-Dame Cathedral','French architecture in the city centre.','Notre-Dame Cathedral was built between 1863 and 1880, with two bell towers 58 meters tall and bricks imported from France.','3_en.mp3','1783ebfaa84b981314466864a169980b98c5c9a60d37ebc9b0e3eaf4c9a1ade6','da_dang','2026-10-29 15:33:07'),(15,3,'es','Catedral de Notre Dame','Arquitectura francesa en el centro de la ciudad.','La catedral de Notre Dame se construyó entre 1863 y 1880, con dos torres campanario de 58 metros de altura y ladrillos importados de Francia.','3_es.mp3','a0b4ab7a37a81d1b6671700a904c8f4ca3f0204d1b1006d6f0597e08a912c391','da_dang','2026-10-29 15:33:08'),(16,3,'ko','노트르담 대성당','도심 한가운데 자리한 프랑스식 건축물.','노트르담 대성당은 1863년부터 1880년까지 지어졌으며, 높이 58미터의 종탑 두 개와 프랑스에서 들여온 벽돌로 이루어져 있습니다.','3_ko.mp3','17a2566700f040182fc4fe4ffa13349ca35585111acf3262d2f2c24c7db4b71a','da_dang','2026-10-29 15:33:09'),(17,3,'zh','圣母大教堂','位于市中心的法式建筑。','圣母大教堂建于1863年至1880年，拥有两座高58米的钟楼，所用砖块全部从法国进口。','3_zh.mp3','62a035c3a393f4a76c1c0932d5aa0dd8627d99dcd6cca1822a0e4ff9a546cf04','da_dang','2026-10-29 15:33:11'),(18,3,'ru','Собор Нотр-Дам','Образец французской архитектуры в центре города.','Собор Нотр-Дам строили с 1863 по 1880 год. У него две колокольни высотой 58 метров, а весь кирпич привезли из Франции.','3_ru.mp3','17c794c132a63ba5fa72730d44a513e3eccffb6a9f74e358bd07092f02cf5ae5','da_dang','2026-10-29 15:33:12'),(19,4,'vi','Bưu điện Trung tâm','Một trong những bưu điện đẹp nhất thế giới.','Bưu điện Thành phố được xây dựng cuối thế kỷ 19, mang kiến trúc Pháp cổ điển và vẫn còn hoạt động đến ngày nay.','4_vi.mp3','4e4eb0d9d5c552dd7d10a528952ce820d8bb7ac391f3cc37ed1fc4a302913dc2','da_dang','2026-10-29 15:33:13'),(20,4,'en','Saigon Central Post Office','One of the most beautiful post offices in the world.','The Central Post Office was built in the late 19th century in classic French style and is still in operation today.','4_en.mp3','4ba052b861dbe92f6f086f606cee8bbb367677df327e095dc1efa6c467be5c48','da_dang','2026-10-29 15:33:14'),(21,4,'es','Oficina Central de Correos de Saigón','Una de las oficinas de correos más bellas del mundo.','La Oficina Central de Correos se construyó a finales del siglo XIX en un estilo francés clásico y sigue en funcionamiento hoy en día.','4_es.mp3','a3f2a07caab805a6eb31acf0fad91c13d2148c2930e02c8000aa6cb9d0a15cb5','da_dang','2026-10-29 15:33:15'),(22,4,'ko','사이공 중앙우체국','세계에서 가장 아름다운 우체국 중 하나.','사이공 중앙우체국은 19세기 말에 고전 프랑스 양식으로 지어졌으며 지금도 운영되고 있습니다.','4_ko.mp3','43aa404c45c3cfc7a39a62274a2ef7740f67fad9d4642c77e398d84983b12547','da_dang','2026-10-29 15:33:16'),(23,4,'zh','西贡中央邮局','世界上最美的邮局之一。','西贡中央邮局建于19世纪末，采用古典法式建筑风格，至今仍在运营。','4_zh.mp3','76ab0be2f3c2b0b80a71a665d390ee6d0de943006ca1f51727e310db77814ba1','da_dang','2026-10-29 15:33:17'),(24,4,'ru','Центральный почтамт Сайгона','Один из красивейших почтамтов мира.','Центральный почтамт построен в конце XIX века в классическом французском стиле и работает до сих пор.','4_ru.mp3','e8143aa2e2b46adde725a0dba75ac759cbda8f9cba526d80ed23cf10c85f4a5c','da_dang','2026-10-29 15:33:18'),(25,5,'vi','Nhà hát Thành phố','Viên ngọc kiến trúc hơn một thế kỷ tuổi.','Nhà hát Thành phố được khánh thành năm 1900, mang phong cách kiến trúc Pháp thời Belle Époque và là nơi tổ chức nhiều chương trình nghệ thuật.','5_vi.mp3','c95ec442034fb1c392d4657f677a14d9be3705cf5974c32f7c7f0930816fdda9','da_dang','2026-10-29 15:33:19'),(26,5,'en','Saigon Opera House','An architectural gem over a century old.','The Saigon Opera House opened in 1900 in French Belle Époque style and still hosts many performances.','5_en.mp3','4b2bce20689775dc860c35edfada9044de2a23307018a2cdca113ffd6dbe2ac8','da_dang','2026-10-29 15:33:20'),(27,5,'es','Teatro de la Ópera de Saigón','Una joya arquitectónica de más de un siglo.','El Teatro de la Ópera de Saigón se inauguró en 1900 con el estilo francés de la Belle Époque y todavía acoge numerosos espectáculos.','5_es.mp3','f50eb90eef3ab1d1b8c137abf17697f1dff158932da5c89c9bd4abe91cfde595','da_dang','2026-10-29 15:33:21'),(28,5,'ko','사이공 오페라 하우스','한 세기가 넘은 건축의 보석.','사이공 오페라 하우스는 1900년에 프랑스 벨 에포크 양식으로 문을 열었으며 지금도 다양한 공연이 열립니다.','5_ko.mp3','8257f2debb3730dd9be8baca4e56e503315ad68920a26d37c2f42d06ffb8986b','da_dang','2026-10-29 15:33:22'),(29,5,'zh','西贡大剧院','拥有百余年历史的建筑瑰宝。','西贡大剧院于1900年落成，属于法国美好年代风格，至今仍举办众多演出。','5_zh.mp3','7ea907102115eb3ea32a16b2922b35279654a907d59a9c097500bdbadc0ffa62','da_dang','2026-10-29 15:33:22'),(30,5,'ru','Сайгонский оперный театр','Архитектурная жемчужина возрастом больше века.','Сайгонский оперный театр открылся в 1900 году в стиле французской «Прекрасной эпохи» и до сих пор принимает множество спектаклей.','5_ru.mp3','de20770dea0777f575f10658c37d98490eb4192891d9ee465c8f5e73570cae47','da_dang','2026-10-29 15:33:23'),(31,6,'vi','Phố đi bộ Nguyễn Huệ','Không gian văn hóa sôi động của thành phố.','Phố đi bộ Nguyễn Huệ nối Ủy ban nhân dân thành phố với bến Bạch Đằng, là nơi diễn ra nhiều lễ hội và hoạt động cộng đồng.','6_vi.mp3','9177fc3ca8dea2057686ed1b276377fdc1fea6cd0be59e0824846ac1081346b8','da_dang','2026-10-29 15:33:24'),(32,6,'en','Nguyen Hue Walking Street','The lively cultural space of the city.','Nguyen Hue Walking Street links City Hall with the Bach Dang riverside and hosts many festivals and community events.','6_en.mp3','87ea9aa8ad3f0b9dadad4a10fbcf48ea8a44d2715f99c060794dcdf59349fe6e','da_dang','2026-10-29 15:33:25'),(33,6,'es','Calle peatonal Nguyen Hue','El animado espacio cultural de la ciudad.','La calle peatonal Nguyen Hue une el Ayuntamiento con el muelle de Bach Dang y es sede de muchos festivales y actividades comunitarias.','6_es.mp3','bb86c533036fc52b48def36c9129b999e38bf9460adbb61ee1cd8ff320400a43','da_dang','2026-10-29 15:33:26'),(34,6,'ko','응우옌후에 보행자 거리','활기 넘치는 도시의 문화 공간.','응우옌후에 보행자 거리는 시청과 박당 부두를 잇는 거리로, 다양한 축제와 지역 행사가 열리는 곳입니다.','6_ko.mp3','a13b0776bbaa41a6146194f00405e2b1f5a2acd32c4d35df3eb9b5d12b3c5f2b','da_dang','2026-10-29 15:33:27'),(35,6,'zh','阮惠步行街','充满活力的城市文化空间。','阮惠步行街连接市人民委员会大楼与白藤码头，经常举办各类节庆和社区活动。','6_zh.mp3','0e2032506636bfa16c4d1aed802b53051edcc8b278cdf57ffc366958c8eaa30d','da_dang','2026-10-29 15:33:28'),(36,6,'ru','Пешеходная улица Нгуен Хюэ','Яркое культурное пространство города.','Пешеходная улица Нгуен Хюэ соединяет здание мэрии с набережной Бать Данг, здесь проходят многие фестивали и городские события.','6_ru.mp3','34dd81d2a3494064328ea1a50464064ea281e493057fca4092b745d9ec980386','da_dang','2026-10-29 15:33:29');
/*!40000 ALTER TABLE `noi_dung_diem` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-22 18:11:57
